export interface AdminProject {
	id: string;
	name: string;
	description: string | null;
	status: "active" | "disabled";
	defaultResponseSchema: string | null;
	requestsPerMinute: number;
	requestsPerDay: number;
	tokensPerDay: number;
	keyCount?: number;
	createdAt: string;
	updatedAt: string;
}

export interface AdminKey {
	id: string;
	projectId: string;
	name: string | null;
	keyPrefix: string;
	lastFour: string;
	createdAt: string;
	lastUsedAt: string | null;
	revokedAt: string | null;
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
	createdAt: string;
	keyPrefix: string | null;
	lastFour: string | null;
}

export interface UsageSummary {
	requests: number;
	successes: number;
	failures: number;
	replays: number;
	tokens: number;
	averageLatencyMs: number;
}

export interface OverviewData {
	range: string;
	projects: number;
	activeKeys: number;
	usage: UsageSummary;
	recent: UsageRow[];
}

export interface ProjectDetailData {
	project: AdminProject;
	keys: AdminKey[];
	usage: {
		usage: UsageSummary;
		recent: UsageRow[];
	};
	range: string;
}
