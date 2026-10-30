// @ts-expect-error
import { env } from "cloudflare:workers";
import { verifyPassword } from "better-auth/crypto";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "#/db";
import { adminSessions, rateLimits } from "#/db/schema";

export const ADMIN_SESSION_COOKIE = "gen_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60;
export const ADMIN_LOGIN_MAX_FAILURES = 5;
export const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;

export class AdminAuthConfigError extends Error {
	constructor() {
		super("ADMIN_PASSWORD_HASH is not configured.");
		this.name = "AdminAuthConfigError";
	}
}

function getAdminPasswordHash(): string | null {
	const value =
		process.env.ADMIN_PASSWORD_HASH || (env as any)?.ADMIN_PASSWORD_HASH;
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function isAdminConfigured(): boolean {
	return getAdminPasswordHash() !== null;
}

async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(value),
	);
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

async function getAdminAuthVersion(): Promise<string> {
	const hash = getAdminPasswordHash();
	if (!hash) return "missing";
	return (await sha256Hex(hash)).slice(0, 16);
}

function randomToken(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
	const hash = getAdminPasswordHash();
	if (!hash) throw new AdminAuthConfigError();
	return verifyPassword({ hash, password });
}

export async function createAdminSession(): Promise<{
	token: string;
	expiresAt: Date;
}> {
	const authVersion = await getAdminAuthVersion();
	const token = randomToken();
	const tokenHash = await sha256Hex(token);
	const now = new Date();
	const expiresAt = new Date(now.getTime() + ADMIN_SESSION_TTL_SECONDS * 1000);

	await db.insert(adminSessions).values({
		id: `adm_${crypto.randomUUID()}`,
		tokenHash,
		authVersion,
		expiresAt,
		createdAt: now,
		lastSeenAt: now,
	});

	db.delete(adminSessions)
		.where(lt(adminSessions.expiresAt, now))
		.catch(() => {});

	return { token, expiresAt };
}

function parseCookies(request: Request): Record<string, string> {
	const header = request.headers.get("cookie");
	if (!header) return {};
	const cookies: Record<string, string> = {};
	for (const part of header.split(";")) {
		const index = part.indexOf("=");
		if (index === -1) continue;
		const key = part.slice(0, index).trim();
		const value = part.slice(index + 1).trim();
		if (key) cookies[key] = decodeURIComponent(value);
	}
	return cookies;
}

export function getAdminSessionToken(request: Request): string | null {
	return parseCookies(request)[ADMIN_SESSION_COOKIE] || null;
}

export async function getAdminSession(
	request: Request,
): Promise<{ id: string; expiresAt: Date } | null> {
	const token = getAdminSessionToken(request);
	if (!token) return null;

	const tokenHash = await sha256Hex(token);
	const authVersion = await getAdminAuthVersion();
	const now = new Date();
	const rows = await db
		.select()
		.from(adminSessions)
		.where(eq(adminSessions.tokenHash, tokenHash))
		.limit(1);
	const session = rows[0];
	if (!session) return null;
	if (session.expiresAt <= now) {
		await db.delete(adminSessions).where(eq(adminSessions.id, session.id));
		return null;
	}
	if (session.authVersion !== authVersion) {
		await db.delete(adminSessions).where(eq(adminSessions.id, session.id));
		return null;
	}

	const lastSeen = new Date(session.lastSeenAt).getTime();
	if (Date.now() - lastSeen > 60_000) {
		db.update(adminSessions)
			.set({ lastSeenAt: now })
			.where(eq(adminSessions.id, session.id))
			.catch(() => {});
	}

	return { id: session.id, expiresAt: session.expiresAt };
}

export async function deleteAdminSession(request: Request): Promise<void> {
	const token = getAdminSessionToken(request);
	if (!token) return;
	const tokenHash = await sha256Hex(token);
	await db.delete(adminSessions).where(eq(adminSessions.tokenHash, tokenHash));
}

export function isSecureRequest(request: Request): boolean {
	return (
		new URL(request.url).protocol === "https:" ||
		process.env.NODE_ENV === "production"
	);
}

export function adminSessionCookie(token: string, secure: boolean): string {
	const maxAge = ADMIN_SESSION_TTL_SECONDS;
	return `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${
		secure ? "; Secure" : ""
	}`;
}

export function clearAdminSessionCookie(secure: boolean): string {
	return `${ADMIN_SESSION_COOKIE}=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0${
		secure ? "; Secure" : ""
	}`;
}

export function isSameOriginRequest(request: Request): boolean {
	const origin = request.headers.get("origin");
	if (origin) {
		try {
			return new URL(origin).origin === new URL(request.url).origin;
		} catch {
			return false;
		}
	}

	const fetchSite = request.headers.get("sec-fetch-site");
	if (fetchSite) return fetchSite === "same-origin";

	return false;
}

export function getAdminClientIp(request: Request): string | null {
	return (
		request.headers.get("cf-connecting-ip") ||
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
		null
	);
}

const LOGIN_FAILURE_ACTION = "admin_login_failure";

export async function checkAdminLoginLimit(ip: string | null): Promise<{
	allowed: boolean;
	retryAfterSeconds?: number;
}> {
	if (!ip) return { allowed: true };
	const key = `admin_ip_${ip}`;
	const windowStart = new Date(Date.now() - ADMIN_LOGIN_WINDOW_MS);
	const rows = await db
		.select({
			count: sql<number>`count(*)`,
			oldest: sql<number>`min(created_at)`,
		})
		.from(rateLimits)
		.where(
			and(
				eq(rateLimits.key, key),
				eq(rateLimits.action, LOGIN_FAILURE_ACTION),
				gte(rateLimits.createdAt, windowStart),
			),
		);

	const count = Number(rows[0]?.count || 0);
	if (count < ADMIN_LOGIN_MAX_FAILURES) return { allowed: true };

	const oldest = Number(rows[0]?.oldest || 0) * 1000;
	const retryAfterSeconds = Math.max(
		1,
		Math.ceil((oldest + ADMIN_LOGIN_WINDOW_MS - Date.now()) / 1000),
	);
	return { allowed: false, retryAfterSeconds };
}

export async function recordAdminLoginFailure(
	ip: string | null,
): Promise<void> {
	if (!ip) return;
	try {
		await db.insert(rateLimits).values({
			id: `rl_${crypto.randomUUID()}`,
			key: `admin_ip_${ip}`,
			action: LOGIN_FAILURE_ACTION,
			createdAt: new Date(),
		});
		db.delete(rateLimits)
			.where(
				lt(rateLimits.createdAt, new Date(Date.now() - 48 * 60 * 60 * 1000)),
			)
			.catch(() => {});
	} catch (error: any) {
		console.warn(
			"[Admin Auth] Failed to record login failure:",
			error?.message,
		);
	}
}

export async function clearAdminLoginFailures(
	ip: string | null,
): Promise<void> {
	if (!ip) return;
	try {
		await db
			.delete(rateLimits)
			.where(
				and(
					eq(rateLimits.key, `admin_ip_${ip}`),
					eq(rateLimits.action, LOGIN_FAILURE_ACTION),
				),
			);
	} catch (error: any) {
		console.warn(
			"[Admin Auth] Failed to clear login failures:",
			error?.message,
		);
	}
}
