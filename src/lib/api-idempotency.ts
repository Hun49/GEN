import { and, eq, lt } from "drizzle-orm";
import { db } from "#/db";
import { type ApiIdempotency, apiIdempotency } from "#/db/schema";
import { canonicalJson } from "#/lib/api-schema";

export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
export const IDEMPOTENCY_STALE_MS = 2 * 60 * 1000;
export const MAX_IDEMPOTENCY_KEY_CHARS = 128;

export type BeginIdempotencyResult =
	| { state: "new"; recordId: string }
	| { state: "in_progress" }
	| { state: "conflict" }
	| { state: "replay"; record: ApiIdempotency };

export async function hashIdempotencyRequest(
	payload: unknown,
	schema: unknown,
): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(canonicalJson({ payload, schema })),
	);
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export function getIdempotencyKey(request: Request): {
	valid: boolean;
	key: string | null;
} {
	const value = request.headers.get("idempotency-key")?.trim();
	if (!value) return { valid: true, key: null };
	if (
		value.length > MAX_IDEMPOTENCY_KEY_CHARS ||
		!/^[A-Za-z0-9._:-]+$/.test(value)
	) {
		return { valid: false, key: null };
	}
	return { valid: true, key: value };
}

async function findRecord(projectId: string, idempotencyKey: string) {
	const rows = await db
		.select()
		.from(apiIdempotency)
		.where(
			and(
				eq(apiIdempotency.projectId, projectId),
				eq(apiIdempotency.idempotencyKey, idempotencyKey),
			),
		)
		.limit(1);
	return rows[0] ?? null;
}

async function cleanupExpired(projectId: string): Promise<void> {
	await db
		.delete(apiIdempotency)
		.where(
			and(
				eq(apiIdempotency.projectId, projectId),
				lt(apiIdempotency.expiresAt, new Date()),
			),
		);
}

async function replaceWithInProgress({
	recordId,
	projectId,
	keyId,
	idempotencyKey,
	requestHash,
	requestId,
}: {
	recordId: string;
	projectId: string;
	keyId: string;
	idempotencyKey: string;
	requestHash: string;
	requestId: string;
}): Promise<string> {
	const now = new Date();
	await db
		.update(apiIdempotency)
		.set({
			projectId,
			keyId,
			idempotencyKey,
			requestHash,
			status: "in_progress",
			responseStatus: null,
			responseBody: null,
			requestId,
			model: null,
			promptTokens: 0,
			completionTokens: 0,
			totalTokens: 0,
			expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
			createdAt: now,
			completedAt: null,
		})
		.where(eq(apiIdempotency.id, recordId));
	return recordId;
}

export async function beginIdempotentRequest({
	projectId,
	keyId,
	idempotencyKey,
	requestHash,
	requestId,
}: {
	projectId: string;
	keyId: string;
	idempotencyKey: string;
	requestHash: string;
	requestId: string;
}): Promise<BeginIdempotencyResult> {
	await cleanupExpired(projectId);

	const existing = await findRecord(projectId, idempotencyKey);
	if (existing) {
		return evaluateExisting({
			existing,
			projectId,
			keyId,
			idempotencyKey,
			requestHash,
			requestId,
		});
	}

	const recordId = `idem_${crypto.randomUUID()}`;
	try {
		await db.insert(apiIdempotency).values({
			id: recordId,
			projectId,
			keyId,
			idempotencyKey,
			requestHash,
			status: "in_progress",
			responseStatus: null,
			responseBody: null,
			requestId,
			model: null,
			promptTokens: 0,
			completionTokens: 0,
			totalTokens: 0,
			expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
			createdAt: new Date(),
			completedAt: null,
		});
		return { state: "new", recordId };
	} catch {
		const raced = await findRecord(projectId, idempotencyKey);
		if (!raced) return { state: "in_progress" };
		return evaluateExisting({
			existing: raced,
			projectId,
			keyId,
			idempotencyKey,
			requestHash,
			requestId,
		});
	}
}

async function evaluateExisting({
	existing,
	projectId,
	keyId,
	idempotencyKey,
	requestHash,
	requestId,
}: {
	existing: ApiIdempotency;
	projectId: string;
	keyId: string;
	idempotencyKey: string;
	requestHash: string;
	requestId: string;
}): Promise<BeginIdempotencyResult> {
	const now = Date.now();
	const expired = existing.expiresAt.getTime() <= now;

	if (existing.status === "completed" && !expired) {
		if (existing.requestHash === requestHash) {
			return { state: "replay", record: existing };
		}
		return { state: "conflict" };
	}

	if (existing.status === "in_progress" && !expired) {
		const stale = now - existing.createdAt.getTime() > IDEMPOTENCY_STALE_MS;
		if (!stale) return { state: "in_progress" };
	}

	const recordId = await replaceWithInProgress({
		recordId: existing.id,
		projectId,
		keyId,
		idempotencyKey,
		requestHash,
		requestId,
	});
	return { state: "new", recordId };
}

export async function completeIdempotentRequest({
	id,
	responseStatus,
	responseBody,
	requestId,
	model,
	promptTokens,
	completionTokens,
	totalTokens,
}: {
	id: string;
	responseStatus: number;
	responseBody: string;
	requestId: string;
	model: string | null;
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}): Promise<void> {
	await db
		.update(apiIdempotency)
		.set({
			status: "completed",
			responseStatus,
			responseBody,
			requestId,
			model,
			promptTokens,
			completionTokens,
			totalTokens,
			expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
			completedAt: new Date(),
		})
		.where(eq(apiIdempotency.id, id));
}

export async function releaseIdempotentRequest(id: string): Promise<void> {
	try {
		await db
			.delete(apiIdempotency)
			.where(
				and(
					eq(apiIdempotency.id, id),
					eq(apiIdempotency.status, "in_progress"),
				),
			);
	} catch (error: any) {
		console.warn(
			"[API Idempotency] Failed to release request:",
			error?.message,
		);
	}
}
