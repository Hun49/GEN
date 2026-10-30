import { and, eq, isNull } from "drizzle-orm";
import { db } from "#/db";
import { apiKeys, apiProjects } from "#/db/schema";

const API_KEY_PREFIX = "gen_live_";
const API_KEY_BYTES = 32;

function toBase64Url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
}

export function generateRawApiKey(): string {
	const bytes = new Uint8Array(API_KEY_BYTES);
	crypto.getRandomValues(bytes);
	return `${API_KEY_PREFIX}${toBase64Url(bytes)}`;
}

export async function hashApiKey(rawKey: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(rawKey),
	);
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

export function keyDisplayParts(rawKey: string): {
	prefix: string;
	lastFour: string;
} {
	return {
		prefix: rawKey.slice(0, 16),
		lastFour: rawKey.slice(-4),
	};
}

export async function createApiKeyRecord({
	projectId,
	name,
}: {
	projectId: string;
	name: string | null;
}) {
	const rawKey = generateRawApiKey();
	const keyHash = await hashApiKey(rawKey);
	const { prefix, lastFour } = keyDisplayParts(rawKey);
	const now = new Date();

	const record = {
		id: `key_${crypto.randomUUID()}`,
		projectId,
		name,
		keyHash,
		keyPrefix: prefix,
		lastFour,
		createdAt: now,
		lastUsedAt: null,
		revokedAt: null,
	};

	await db.insert(apiKeys).values(record);

	return { rawKey, record };
}

export function toPublicApiKey(record: typeof apiKeys.$inferSelect) {
	return {
		id: record.id,
		projectId: record.projectId,
		name: record.name,
		keyPrefix: record.keyPrefix,
		lastFour: record.lastFour,
		createdAt: record.createdAt,
		lastUsedAt: record.lastUsedAt,
		revokedAt: record.revokedAt,
	};
}

export type ApiKeyAuthResult =
	| {
			ok: true;
			key: typeof apiKeys.$inferSelect;
			project: typeof apiProjects.$inferSelect;
	  }
	| {
			ok: false;
			code: "INVALID_API_KEY" | "KEY_REVOKED" | "PROJECT_DISABLED";
	  };

export async function authenticateApiKey(
	rawKey: string,
): Promise<ApiKeyAuthResult> {
	const keyHash = await hashApiKey(rawKey);
	const rows = await db
		.select({ key: apiKeys, project: apiProjects })
		.from(apiKeys)
		.innerJoin(apiProjects, eq(apiKeys.projectId, apiProjects.id))
		.where(eq(apiKeys.keyHash, keyHash))
		.limit(1);

	const row = rows[0];
	if (!row) return { ok: false, code: "INVALID_API_KEY" };
	if (row.key.revokedAt) return { ok: false, code: "KEY_REVOKED" };
	if (row.project.status !== "active") {
		return { ok: false, code: "PROJECT_DISABLED" };
	}

	return { ok: true, key: row.key, project: row.project };
}

export async function markApiKeyUsed(keyId: string): Promise<void> {
	try {
		await db
			.update(apiKeys)
			.set({ lastUsedAt: new Date() })
			.where(eq(apiKeys.id, keyId));
	} catch (error: any) {
		console.warn("[API Keys] Failed to update lastUsedAt:", error?.message);
	}
}

export async function revokeApiKey({
	keyId,
	projectId,
}: {
	keyId: string;
	projectId?: string;
}): Promise<boolean> {
	const conditions = [eq(apiKeys.id, keyId), isNull(apiKeys.revokedAt)];
	if (projectId) conditions.push(eq(apiKeys.projectId, projectId));

	const existing = await db
		.select({ id: apiKeys.id })
		.from(apiKeys)
		.where(and(...conditions))
		.limit(1);
	if (!existing[0]) return false;

	await db
		.update(apiKeys)
		.set({ revokedAt: new Date() })
		.where(eq(apiKeys.id, keyId));
	return true;
}
