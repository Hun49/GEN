import { sql } from "drizzle-orm";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ─── Better Auth Tables ───────────────────────────────────────────────────────
export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("emailVerified", { mode: "boolean" })
		.notNull()
		.default(false),
	image: text("image"),
	createdAt: integer("createdAt", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updatedAt", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	displayName: text("displayName"),
	isAnonymous: integer("isAnonymous", { mode: "boolean" }).default(false),
});

export const session = sqliteTable("session", {
	id: text("id").primaryKey(),
	expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
	token: text("token").notNull().unique(),
	createdAt: integer("createdAt", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updatedAt", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	ipAddress: text("ipAddress"),
	userAgent: text("userAgent"),
	userId: text("userId")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
	id: text("id").primaryKey(),
	accountId: text("accountId").notNull(),
	providerId: text("providerId").notNull(),
	userId: text("userId")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	accessToken: text("accessToken"),
	refreshToken: text("refreshToken"),
	idToken: text("idToken"),
	accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }),
	refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
		mode: "timestamp",
	}),
	scope: text("scope"),
	password: text("password"),
	createdAt: integer("createdAt", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updatedAt", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

export const verification = sqliteTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
	createdAt: integer("createdAt", { mode: "timestamp" }).default(
		sql`(unixepoch())`,
	),
	updatedAt: integer("updatedAt", { mode: "timestamp" }).default(
		sql`(unixepoch())`,
	),
});

// ─── Documents ───────────────────────────────────────────────────────────────
export const documents = sqliteTable(
	"documents",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		filename: text("filename").notNull(),
		fileType: text("file_type", { enum: ["pdf", "pptx", "docx"] }).notNull(),
		fileSize: integer("file_size").notNull(),
		r2Key: text("r2_key").notNull(),
		status: text("status", {
			enum: ["uploading", "uploaded", "processing", "ready", "failed"],
		})
			.notNull()
			.default("uploading"),
		extractedText: text("extracted_text"),
		errorMessage: text("error_message"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(table) => [index("idx_documents_user_id").on(table.userId)],
);

// ─── Exams ───────────────────────────────────────────────────────────────────
export const exams = sqliteTable(
	"exams",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").notNull(),
		documentId: text("document_id").references(() => documents.id, {
			onDelete: "set null",
		}),
		authorDisplayName: text("author_display_name").notNull(),
		title: text("title").notNull(),
		subject: text("subject").notNull(),
		description: text("description").notNull().default(""),
		difficulty: text("difficulty", {
			enum: ["easy", "medium", "hard"],
		}).notNull(),
		questionCount: integer("question_count").notNull(),
		isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
		tags: text("tags").notNull().default("[]"), // JSON array string
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(table) => [
		index("idx_exams_user_id").on(table.userId),
		index("idx_exams_created_at").on(table.createdAt),
	],
);

// ─── Questions ───────────────────────────────────────────────────────────────
export const questions = sqliteTable(
	"questions",
	{
		id: text("id").primaryKey(),
		examId: text("exam_id")
			.notNull()
			.references(() => exams.id, { onDelete: "cascade" }),
		order: integer("order").notNull(),
		type: text("type", {
			enum: ["multiple-choice", "true-false", "short-answer"],
		}).notNull(),
		question: text("question").notNull(),
		options: text("options"), // JSON array string, null for short-answer
		correctAnswer: text("correct_answer").notNull(),
		explanation: text("explanation").notNull(),
	},
	(table) => [index("idx_questions_exam_id").on(table.examId)],
);

// ─── Attempts ────────────────────────────────────────────────────────────────
export const attempts = sqliteTable(
	"attempts",
	{
		id: text("id").primaryKey(),
		examId: text("exam_id")
			.notNull()
			.references(() => exams.id, { onDelete: "cascade" }),
		userId: text("user_id").notNull(),
		status: text("status", { enum: ["in-progress", "completed", "abandoned"] })
			.notNull()
			.default("in-progress"),
		score: integer("score"), // 0–100, null until submitted
		totalQuestions: integer("total_questions").notNull(),
		correctCount: integer("correct_count"), // null until submitted
		startedAt: integer("started_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		completedAt: integer("completed_at", { mode: "timestamp" }),
		lastActiveAt: integer("last_active_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(table) => [
		index("idx_attempts_user_id").on(table.userId),
		index("idx_attempts_exam_id").on(table.examId),
	],
);

// ─── Attempt Answers ─────────────────────────────────────────────────────────
export const attemptAnswers = sqliteTable(
	"attempt_answers",
	{
		id: text("id").primaryKey(),
		attemptId: text("attempt_id")
			.notNull()
			.references(() => attempts.id, { onDelete: "cascade" }),
		questionId: text("question_id")
			.notNull()
			.references(() => questions.id, { onDelete: "cascade" }),
		userAnswer: text("user_answer").notNull(),
		isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
		answeredAt: integer("answered_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(table) => [
		index("idx_attempt_answers_attempt_id").on(table.attemptId),
		index("idx_attempt_answers_lookup").on(table.attemptId, table.questionId),
	],
);

// ─── Rate Limits ─────────────────────────────────────────────────────────────
export const rateLimits = sqliteTable(
	"rate_limits",
	{
		id: text("id").primaryKey(),
		key: text("key").notNull(),
		action: text("action").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(table) => [
		index("idx_rate_limits_lookup").on(
			table.key,
			table.action,
			table.createdAt,
		),
	],
);

// ─── Admin Sessions ──────────────────────────────────────────────────────────
export const adminSessions = sqliteTable(
	"admin_sessions",
	{
		id: text("id").primaryKey(),
		tokenHash: text("token_hash").notNull().unique(),
		authVersion: text("auth_version").notNull(),
		expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		lastSeenAt: integer("last_seen_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(table) => [index("idx_admin_sessions_expires_at").on(table.expiresAt)],
);

// ─── API Projects ────────────────────────────────────────────────────────────
export const apiProjects = sqliteTable(
	"api_projects",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull().unique(),
		description: text("description"),
		status: text("status", { enum: ["active", "disabled"] })
			.notNull()
			.default("active"),
		defaultResponseSchema: text("default_response_schema"),
		requestsPerMinute: integer("requests_per_minute").notNull().default(10),
		requestsPerDay: integer("requests_per_day").notNull().default(100),
		tokensPerDay: integer("tokens_per_day").notNull().default(150_000),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(table) => [
		index("idx_api_projects_status").on(table.status),
		index("idx_api_projects_created_at").on(table.createdAt),
	],
);

// ─── API Keys ────────────────────────────────────────────────────────────────
export const apiKeys = sqliteTable(
	"api_keys",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => apiProjects.id, { onDelete: "cascade" }),
		name: text("name"),
		keyHash: text("key_hash").notNull().unique(),
		keyPrefix: text("key_prefix").notNull(),
		lastFour: text("last_four").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
		revokedAt: integer("revoked_at", { mode: "timestamp" }),
	},
	(table) => [
		index("idx_api_keys_project_id").on(table.projectId),
		index("idx_api_keys_created_at").on(table.createdAt),
	],
);

// ─── API Usage ───────────────────────────────────────────────────────────────
export const apiUsage = sqliteTable(
	"api_usage",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => apiProjects.id, { onDelete: "cascade" }),
		keyId: text("key_id")
			.notNull()
			.references(() => apiKeys.id, { onDelete: "cascade" }),
		requestId: text("request_id").notNull(),
		externalId: text("external_id"),
		statusCode: integer("status_code").notNull(),
		outcome: text("outcome", {
			enum: [
				"success",
				"validation_error",
				"schema_error",
				"rate_limited",
				"quota_exceeded",
				"generation_failed",
				"ai_unavailable",
				"idempotency_replay",
				"idempotency_conflict",
				"idempotency_in_progress",
				"internal_error",
			],
		}).notNull(),
		errorCode: text("error_code"),
		schemaSource: text("schema_source", {
			enum: ["default", "project", "request"],
		}),
		model: text("model"),
		promptTokens: integer("prompt_tokens").notNull().default(0),
		completionTokens: integer("completion_tokens").notNull().default(0),
		totalTokens: integer("total_tokens").notNull().default(0),
		questionCount: integer("question_count"),
		difficulty: text("difficulty"),
		subject: text("subject"),
		latencyMs: integer("latency_ms"),
		isReplay: integer("is_replay", { mode: "boolean" })
			.notNull()
			.default(false),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(table) => [
		index("idx_api_usage_project_created").on(table.projectId, table.createdAt),
		index("idx_api_usage_key_created").on(table.keyId, table.createdAt),
		index("idx_api_usage_created_at").on(table.createdAt),
		index("idx_api_usage_request_id").on(table.requestId),
	],
);

// ─── API Idempotency ─────────────────────────────────────────────────────────
export const apiIdempotency = sqliteTable(
	"api_idempotency",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => apiProjects.id, { onDelete: "cascade" }),
		keyId: text("key_id").references(() => apiKeys.id, {
			onDelete: "set null",
		}),
		idempotencyKey: text("idempotency_key").notNull(),
		requestHash: text("request_hash").notNull(),
		status: text("status", { enum: ["in_progress", "completed"] })
			.notNull()
			.default("in_progress"),
		responseStatus: integer("response_status"),
		responseBody: text("response_body"),
		requestId: text("request_id").notNull(),
		model: text("model"),
		promptTokens: integer("prompt_tokens").notNull().default(0),
		completionTokens: integer("completion_tokens").notNull().default(0),
		totalTokens: integer("total_tokens").notNull().default(0),
		expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		completedAt: integer("completed_at", { mode: "timestamp" }),
	},
	(table) => [
		uniqueIndex("idx_api_idempotency_project_key").on(
			table.projectId,
			table.idempotencyKey,
		),
		index("idx_api_idempotency_expires_at").on(table.expiresAt),
	],
);

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Exam = typeof exams.$inferSelect;
export type NewExam = typeof exams.$inferInsert;
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
export type Attempt = typeof attempts.$inferSelect;
export type NewAttempt = typeof attempts.$inferInsert;
export type AttemptAnswer = typeof attemptAnswers.$inferSelect;
export type NewAttemptAnswer = typeof attemptAnswers.$inferInsert;
export type RateLimit = typeof rateLimits.$inferSelect;
export type NewRateLimit = typeof rateLimits.$inferInsert;
export type AdminSession = typeof adminSessions.$inferSelect;
export type NewAdminSession = typeof adminSessions.$inferInsert;
export type ApiProject = typeof apiProjects.$inferSelect;
export type NewApiProject = typeof apiProjects.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type ApiUsage = typeof apiUsage.$inferSelect;
export type NewApiUsage = typeof apiUsage.$inferInsert;
export type ApiIdempotency = typeof apiIdempotency.$inferSelect;
export type NewApiIdempotency = typeof apiIdempotency.$inferInsert;
