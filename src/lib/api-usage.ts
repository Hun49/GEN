import { and, desc, eq, gte, isNull, type SQL, sql } from "drizzle-orm";
import { db } from "#/db";
import { type ApiProject, apiKeys, apiProjects, apiUsage } from "#/db/schema";

export type UsageRange = "24h" | "30d" | "all";

export type UsageOutcome = (typeof apiUsage.$inferInsert)["outcome"];

export interface UsageSummary {
	requests: number;
	successes: number;
	failures: number;
	replays: number;
	tokens: number;
	averageLatencyMs: number;
}

export interface UsageInput {
	projectId: string;
	keyId: string;
	requestId: string;
	externalId?: string | null;
	statusCode: number;
	outcome: UsageOutcome;
	errorCode?: string | null;
	schemaSource?: "default" | "project" | "request" | null;
	model?: string | null;
	promptTokens?: number;
	completionTokens?: number;
	totalTokens?: number;
	questionCount?: number | null;
	difficulty?: string | null;
	subject?: string | null;
	latencyMs?: number | null;
	isReplay?: boolean;
}

export function parseUsageRange(value: string | null): UsageRange {
	if (value === "30d" || value === "all") return value;
	return "24h";
}

export function usageRangeStart(range: UsageRange): Date | null {
	if (range === "24h") return new Date(Date.now() - 24 * 60 * 60 * 1000);
	if (range === "30d") return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
	return null;
}

function usageConditions({
	projectId,
	keyId,
	range,
}: {
	projectId?: string;
	keyId?: string;
	range: UsageRange;
}): SQL[] {
	const conditions: SQL[] = [];
	if (projectId) conditions.push(eq(apiUsage.projectId, projectId));
	if (keyId) conditions.push(eq(apiUsage.keyId, keyId));
	const start = usageRangeStart(range);
	if (start) conditions.push(gte(apiUsage.createdAt, start));
	return conditions;
}

export async function recordApiUsage(input: UsageInput): Promise<void> {
	try {
		await db.insert(apiUsage).values({
			id: `use_${crypto.randomUUID()}`,
			projectId: input.projectId,
			keyId: input.keyId,
			requestId: input.requestId,
			externalId: input.externalId ?? null,
			statusCode: input.statusCode,
			outcome: input.outcome,
			errorCode: input.errorCode ?? null,
			schemaSource: input.schemaSource ?? null,
			model: input.model ?? null,
			promptTokens: input.promptTokens ?? 0,
			completionTokens: input.completionTokens ?? 0,
			totalTokens: input.totalTokens ?? 0,
			questionCount: input.questionCount ?? null,
			difficulty: input.difficulty ?? null,
			subject: input.subject ?? null,
			latencyMs: input.latencyMs ?? null,
			isReplay: input.isReplay ?? false,
			createdAt: new Date(),
		});
	} catch (error: any) {
		console.error("[API Usage] Failed to record usage:", error?.message);
	}
}

export async function getUsageSummary({
	projectId,
	keyId,
	range,
}: {
	projectId?: string;
	keyId?: string;
	range: UsageRange;
}): Promise<UsageSummary> {
	const conditions = usageConditions({ projectId, keyId, range });
	const rows = await db
		.select({
			requests: sql<number>`count(*)`,
			successes: sql<number>`sum(case when status_code between 200 and 299 then 1 else 0 end)`,
			replays: sql<number>`sum(case when is_replay = 1 then 1 else 0 end)`,
			tokens: sql<number>`coalesce(sum(case when is_replay = 0 then total_tokens else 0 end), 0)`,
			averageLatencyMs: sql<number>`coalesce(avg(latency_ms), 0)`,
		})
		.from(apiUsage)
		.where(and(...conditions));

	const row = rows[0];
	const requests = Number(row?.requests || 0);
	const successes = Number(row?.successes || 0);
	return {
		requests,
		successes,
		failures: Math.max(0, requests - successes),
		replays: Number(row?.replays || 0),
		tokens: Number(row?.tokens || 0),
		averageLatencyMs: Math.round(Number(row?.averageLatencyMs || 0)),
	};
}

export interface UsageRow {
	id: string;
	requestId: string;
	externalId: string | null;
	statusCode: number;
	outcome: string;
	errorCode: string | null;
	schemaSource: string | null;
	model: string | null;
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	questionCount: number | null;
	difficulty: string | null;
	subject: string | null;
	latencyMs: number | null;
	isReplay: boolean;
	createdAt: Date;
	keyPrefix: string | null;
	lastFour: string | null;
}

export async function listUsage({
	projectId,
	keyId,
	range,
	limit = 50,
}: {
	projectId?: string;
	keyId?: string;
	range: UsageRange;
	limit?: number;
}): Promise<UsageRow[]> {
	const conditions = usageConditions({ projectId, keyId, range });
	const rows = await db
		.select({
			id: apiUsage.id,
			requestId: apiUsage.requestId,
			externalId: apiUsage.externalId,
			statusCode: apiUsage.statusCode,
			outcome: apiUsage.outcome,
			errorCode: apiUsage.errorCode,
			schemaSource: apiUsage.schemaSource,
			model: apiUsage.model,
			promptTokens: apiUsage.promptTokens,
			completionTokens: apiUsage.completionTokens,
			totalTokens: apiUsage.totalTokens,
			questionCount: apiUsage.questionCount,
			difficulty: apiUsage.difficulty,
			subject: apiUsage.subject,
			latencyMs: apiUsage.latencyMs,
			isReplay: apiUsage.isReplay,
			createdAt: apiUsage.createdAt,
			keyPrefix: apiKeys.keyPrefix,
			lastFour: apiKeys.lastFour,
		})
		.from(apiUsage)
		.leftJoin(apiKeys, eq(apiUsage.keyId, apiKeys.id))
		.where(and(...conditions))
		.orderBy(desc(apiUsage.createdAt))
		.limit(Math.min(Math.max(limit, 1), 100));

	return rows.map((row) => ({
		...row,
		keyPrefix: row.keyPrefix ?? null,
		lastFour: row.lastFour ?? null,
	}));
}

export interface ApiLimitCheck {
	allowed: boolean;
	code?: "RATE_LIMITED" | "QUOTA_EXCEEDED";
	message?: string;
	retryAfterSeconds?: number;
	headers: Record<string, string>;
}

export async function checkApiLimits(
	project: ApiProject,
): Promise<ApiLimitCheck> {
	const now = Date.now();
	const minuteStart = new Date(now - 60 * 1000);
	const dayStart = new Date(now - 24 * 60 * 60 * 1000);

	const [minuteRows, dayRows, tokenRows] = await Promise.all([
		db
			.select({
				count: sql<number>`count(*)`,
				oldest: sql<number>`min(created_at)`,
			})
			.from(apiUsage)
			.where(
				and(
					eq(apiUsage.projectId, project.id),
					gte(apiUsage.createdAt, minuteStart),
				),
			),
		db
			.select({
				count: sql<number>`count(*)`,
				oldest: sql<number>`min(created_at)`,
			})
			.from(apiUsage)
			.where(
				and(
					eq(apiUsage.projectId, project.id),
					gte(apiUsage.createdAt, dayStart),
					eq(apiUsage.isReplay, false),
				),
			),
		db
			.select({ tokens: sql<number>`coalesce(sum(total_tokens), 0)` })
			.from(apiUsage)
			.where(
				and(
					eq(apiUsage.projectId, project.id),
					gte(apiUsage.createdAt, dayStart),
					eq(apiUsage.isReplay, false),
				),
			),
	]);

	const minuteCount = Number(minuteRows[0]?.count || 0);
	const dayCount = Number(dayRows[0]?.count || 0);
	const dayTokens = Number(tokenRows[0]?.tokens || 0);

	const minuteRemaining = Math.max(0, project.requestsPerMinute - minuteCount);
	const minuteReset = Math.ceil(
		Number(minuteRows[0]?.oldest || now / 1000) + 60,
	);
	const dayRequestsRemaining = Math.max(0, project.requestsPerDay - dayCount);
	const dayTokensRemaining = Math.max(0, project.tokensPerDay - dayTokens);

	const headers: Record<string, string> = {
		"X-RateLimit-Limit": String(project.requestsPerMinute),
		"X-RateLimit-Remaining": String(minuteRemaining),
		"X-RateLimit-Reset": String(minuteReset),
		"X-Gen-Daily-Requests-Remaining": String(dayRequestsRemaining),
		"X-Gen-Daily-Tokens-Remaining": String(dayTokensRemaining),
	};

	if (minuteCount >= project.requestsPerMinute) {
		const oldest = Number(minuteRows[0]?.oldest || now / 1000) * 1000;
		const retryAfterSeconds = Math.max(
			1,
			Math.ceil((oldest + 60 * 1000 - now) / 1000),
		);
		return {
			allowed: false,
			code: "RATE_LIMITED",
			message: "Too many requests. Please retry later.",
			retryAfterSeconds,
			headers,
		};
	}

	if (dayCount >= project.requestsPerDay) {
		const oldest = Number(dayRows[0]?.oldest || now / 1000) * 1000;
		const retryAfterSeconds = Math.max(
			1,
			Math.ceil((oldest + 24 * 60 * 60 * 1000 - now) / 1000),
		);
		return {
			allowed: false,
			code: "QUOTA_EXCEEDED",
			message: "Daily request quota exceeded.",
			retryAfterSeconds,
			headers,
		};
	}

	if (dayTokens >= project.tokensPerDay) {
		return {
			allowed: false,
			code: "QUOTA_EXCEEDED",
			message: "Daily token quota exceeded.",
			retryAfterSeconds: 24 * 60 * 60,
			headers,
		};
	}

	return { allowed: true, headers };
}

export async function getAdminOverview(range: UsageRange) {
	const [projectRows, keyRows, usage, recent] = await Promise.all([
		db.select({ count: sql<number>`count(*)` }).from(apiProjects),
		db
			.select({ count: sql<number>`count(*)` })
			.from(apiKeys)
			.where(isNull(apiKeys.revokedAt)),
		getUsageSummary({ range }),
		listUsage({ range, limit: 25 }),
	]);

	return {
		projects: Number(projectRows[0]?.count || 0),
		activeKeys: Number(keyRows[0]?.count || 0),
		usage,
		recent,
	};
}

export async function getProjectUsage(projectId: string, range: UsageRange) {
	const [usage, recent] = await Promise.all([
		getUsageSummary({ projectId, range }),
		listUsage({ projectId, range, limit: 50 }),
	]);
	return { usage, recent };
}

export async function getKeyUsage(keyId: string, range: UsageRange) {
	const [usage, recent] = await Promise.all([
		getUsageSummary({ keyId, range }),
		listUsage({ keyId, range, limit: 50 }),
	]);
	return { usage, recent };
}
