// @ts-expect-error
import { env } from "cloudflare:workers";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
	bearerHeader,
	createRequestId,
	errorResponse,
	noStoreHeaders,
} from "#/lib/api-errors";
import {
	beginIdempotentRequest,
	completeIdempotentRequest,
	getIdempotencyKey,
	hashIdempotencyRequest,
	releaseIdempotentRequest,
} from "#/lib/api-idempotency";
import { authenticateApiKey, markApiKeyUsed } from "#/lib/api-keys";
import { resolveResponseSchema, type SchemaSource } from "#/lib/api-schema";
import { checkApiLimits, recordApiUsage } from "#/lib/api-usage";
import {
	type ExternalExamInput,
	ExternalGenerationError,
	generateExternalExam,
} from "#/lib/external-exam";

const MAX_BODY_BYTES = 100_000;
const MAX_CONTENT_CHARS = 20_000;
const MAX_QUESTIONS = 10;

const RequestSchema = z
	.object({
		externalId: z.string().max(128).optional(),
		content: z
			.string()
			.max(MAX_CONTENT_CHARS)
			.refine((value) => value.trim().length > 0, "content cannot be empty"),
		instructions: z.string().max(2_000).optional(),
		subject: z.string().max(120).optional(),
		difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
		questionCount: z.number().int().min(1).max(MAX_QUESTIONS).default(10),
		questionTypes: z
			.array(z.enum(["multiple-choice", "true-false"]))
			.min(1)
			.max(2)
			.default(["multiple-choice"]),
		language: z.string().max(40).default("English"),
		audience: z.string().max(80).optional(),
		sourceOnly: z.boolean().default(true),
		responseSchema: z.record(z.string(), z.unknown()).optional(),
	})
	.strict();

function getAiConfig() {
	const apiKey = process.env.GROQ_API_KEY || (env as any)?.GROQ_API_KEY;
	const baseUrl =
		process.env.GROQ_BASE_URL ||
		(env as any)?.GROQ_BASE_URL ||
		"https://api.groq.com/openai/v1";
	return { apiKey, baseUrl };
}

export const Route = createFileRoute("/api/v1/generate")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const requestId = createRequestId();
				const startedAt = Date.now();
				let externalId: string | undefined;
				let schemaSource: SchemaSource | null = null;
				let questionCount: number | null = null;
				let difficulty: string | null = null;
				let subject: string | null = null;

				const rawKey = bearerHeader(request);
				if (!rawKey) {
					return errorResponse({
						code: "INVALID_API_KEY",
						message: "A valid Bearer API key is required.",
						status: 401,
						requestId,
						headers: { "WWW-Authenticate": "Bearer" },
					});
				}

				let auth: Awaited<ReturnType<typeof authenticateApiKey>>;
				try {
					auth = await authenticateApiKey(rawKey);
				} catch (error: any) {
					console.error(
						"[API Generate] Authentication failed:",
						error?.message,
					);
					return errorResponse({
						code: "INTERNAL_ERROR",
						message: "Unable to authenticate the request.",
						status: 500,
						requestId,
					});
				}
				if (!auth.ok) {
					const status = auth.code === "INVALID_API_KEY" ? 401 : 403;
					return errorResponse({
						code: auth.code,
						message:
							auth.code === "KEY_REVOKED"
								? "This API key has been revoked."
								: auth.code === "PROJECT_DISABLED"
									? "This API project is disabled."
									: "The provided API key is invalid.",
						status,
						requestId,
						...(status === 401
							? { headers: { "WWW-Authenticate": "Bearer" } }
							: {}),
					});
				}

				const { key, project } = auth;
				await markApiKeyUsed(key.id);

				const logUsage = async (input: {
					statusCode: number;
					outcome:
						| "success"
						| "validation_error"
						| "schema_error"
						| "rate_limited"
						| "quota_exceeded"
						| "generation_failed"
						| "ai_unavailable"
						| "idempotency_replay"
						| "idempotency_conflict"
						| "idempotency_in_progress"
						| "internal_error";
					errorCode?: string | null;
					model?: string | null;
					promptTokens?: number;
					completionTokens?: number;
					totalTokens?: number;
					isReplay?: boolean;
				}) => {
					await recordApiUsage({
						projectId: project.id,
						keyId: key.id,
						requestId,
						externalId,
						schemaSource,
						questionCount,
						difficulty,
						subject,
						statusCode: input.statusCode,
						outcome: input.outcome,
						errorCode: input.errorCode,
						model: input.model,
						promptTokens: input.promptTokens,
						completionTokens: input.completionTokens,
						totalTokens: input.totalTokens,
						isReplay: input.isReplay,
						latencyMs: Date.now() - startedAt,
					});
				};

				let limits: Awaited<ReturnType<typeof checkApiLimits>>;
				try {
					limits = await checkApiLimits(project);
				} catch (error: any) {
					console.error("[API Generate] Limit check failed:", error?.message);
					await logUsage({
						statusCode: 500,
						outcome: "internal_error",
						errorCode: "INTERNAL_ERROR",
					});
					return errorResponse({
						code: "INTERNAL_ERROR",
						message: "Unable to check API limits.",
						status: 500,
						requestId,
					});
				}
				const limitHeaders = limits.headers;
				if (!limits.allowed) {
					await logUsage({
						statusCode: 429,
						outcome:
							limits.code === "RATE_LIMITED"
								? "rate_limited"
								: "quota_exceeded",
						errorCode: limits.code,
					});
					return errorResponse({
						code: limits.code ?? "RATE_LIMITED",
						message: limits.message ?? "Request limit exceeded.",
						status: 429,
						requestId,
						headers: {
							...limitHeaders,
							...(limits.retryAfterSeconds
								? { "Retry-After": String(limits.retryAfterSeconds) }
								: {}),
						},
					});
				}

				const contentType = request.headers.get("content-type") || "";
				if (!contentType.toLowerCase().includes("application/json")) {
					await logUsage({
						statusCode: 400,
						outcome: "validation_error",
						errorCode: "VALIDATION_ERROR",
					});
					return errorResponse({
						code: "VALIDATION_ERROR",
						message: "Content-Type must be application/json.",
						status: 400,
						requestId,
						headers: limitHeaders,
					});
				}

				const contentLength = Number(
					request.headers.get("content-length") || 0,
				);
				if (contentLength > MAX_BODY_BYTES) {
					await logUsage({
						statusCode: 413,
						outcome: "validation_error",
						errorCode: "CONTENT_TOO_LARGE",
					});
					return errorResponse({
						code: "CONTENT_TOO_LARGE",
						message: "Request body is too large.",
						status: 413,
						requestId,
						headers: limitHeaders,
					});
				}

				let rawBody: string;
				try {
					rawBody = await request.text();
				} catch {
					await logUsage({
						statusCode: 400,
						outcome: "validation_error",
						errorCode: "VALIDATION_ERROR",
					});
					return errorResponse({
						code: "VALIDATION_ERROR",
						message: "Request body could not be read.",
						status: 400,
						requestId,
						headers: limitHeaders,
					});
				}

				if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
					await logUsage({
						statusCode: 413,
						outcome: "validation_error",
						errorCode: "CONTENT_TOO_LARGE",
					});
					return errorResponse({
						code: "CONTENT_TOO_LARGE",
						message: "Request body is too large.",
						status: 413,
						requestId,
						headers: limitHeaders,
					});
				}

				let rawJson: unknown;
				try {
					rawJson = JSON.parse(rawBody);
				} catch {
					await logUsage({
						statusCode: 400,
						outcome: "validation_error",
						errorCode: "VALIDATION_ERROR",
					});
					return errorResponse({
						code: "VALIDATION_ERROR",
						message: "Request body must be valid JSON.",
						status: 400,
						requestId,
						headers: limitHeaders,
					});
				}

				const parsed = RequestSchema.safeParse(rawJson);
				if (!parsed.success) {
					await logUsage({
						statusCode: 400,
						outcome: "validation_error",
						errorCode: "VALIDATION_ERROR",
					});
					return errorResponse({
						code: "VALIDATION_ERROR",
						message: "The request body is invalid.",
						status: 400,
						requestId,
						details: parsed.error.issues.slice(0, 10).map((issue) => ({
							path: issue.path.join("."),
							message: issue.message,
						})),
						headers: limitHeaders,
					});
				}

				const input = parsed.data;
				externalId = input.externalId;
				questionCount = input.questionCount;
				difficulty = input.difficulty;
				subject = input.subject ?? null;
				const questionTypes = Array.from(new Set(input.questionTypes));

				const resolved = resolveResponseSchema({
					requestSchema: input.responseSchema,
					projectSchemaText: project.defaultResponseSchema,
				});

				if (!resolved.valid || !resolved.resolved) {
					const isProjectSchema = resolved.source === "project";
					await logUsage({
						statusCode: isProjectSchema ? 500 : 400,
						outcome: "schema_error",
						errorCode: isProjectSchema
							? "INTERNAL_ERROR"
							: "INVALID_RESPONSE_SCHEMA",
					});
					return errorResponse({
						code: isProjectSchema
							? "INTERNAL_ERROR"
							: "INVALID_RESPONSE_SCHEMA",
						message: isProjectSchema
							? "The project response schema is invalid."
							: "The response schema is invalid.",
						status: isProjectSchema ? 500 : 400,
						requestId,
						externalId,
						details: isProjectSchema ? undefined : resolved.details,
						headers: limitHeaders,
					});
				}

				schemaSource = resolved.resolved.source;
				const schema = resolved.resolved.schema;

				const idempotency = getIdempotencyKey(request);
				if (!idempotency.valid) {
					await logUsage({
						statusCode: 400,
						outcome: "validation_error",
						errorCode: "VALIDATION_ERROR",
					});
					return errorResponse({
						code: "VALIDATION_ERROR",
						message:
							"Idempotency-Key must be 1-128 characters using letters, numbers, dot, underscore, colon, or hyphen.",
						status: 400,
						requestId,
						externalId,
						headers: limitHeaders,
					});
				}

				let idempotencyRecordId: string | null = null;
				if (idempotency.key) {
					const requestHash = await hashIdempotencyRequest(parsed.data, schema);
					let begin: Awaited<ReturnType<typeof beginIdempotentRequest>>;
					try {
						begin = await beginIdempotentRequest({
							projectId: project.id,
							keyId: key.id,
							idempotencyKey: idempotency.key,
							requestHash,
							requestId,
						});
					} catch (error: any) {
						console.error(
							"[API Generate] Idempotency check failed:",
							error?.message,
						);
						await logUsage({
							statusCode: 500,
							outcome: "internal_error",
							errorCode: "INTERNAL_ERROR",
						});
						return errorResponse({
							code: "INTERNAL_ERROR",
							message: "Unable to process the idempotency key.",
							status: 500,
							requestId,
							externalId,
							headers: limitHeaders,
						});
					}

					if (begin.state === "replay") {
						const record = begin.record;
						await logUsage({
							statusCode: record.responseStatus ?? 200,
							outcome: "idempotency_replay",
							model: record.model,
							promptTokens: record.promptTokens,
							completionTokens: record.completionTokens,
							totalTokens: record.totalTokens,
							isReplay: true,
						});
						return new Response(record.responseBody ?? "{}", {
							status: record.responseStatus ?? 200,
							headers: noStoreHeaders({
								...limitHeaders,
								"X-Gen-Request-Id": record.requestId,
								"X-Gen-Idempotent-Replay": "true",
								"X-Gen-Schema-Source": schemaSource,
								...(record.model ? { "X-Gen-Model": record.model } : {}),
								"X-Gen-Usage-Prompt-Tokens": String(record.promptTokens),
								"X-Gen-Usage-Completion-Tokens": String(
									record.completionTokens,
								),
								"X-Gen-Usage-Total-Tokens": String(record.totalTokens),
							}),
						});
					}

					if (begin.state === "conflict") {
						await logUsage({
							statusCode: 409,
							outcome: "idempotency_conflict",
							errorCode: "IDEMPOTENCY_CONFLICT",
						});
						return errorResponse({
							code: "IDEMPOTENCY_CONFLICT",
							message:
								"This Idempotency-Key was already used with a different request.",
							status: 409,
							requestId,
							externalId,
							headers: limitHeaders,
						});
					}

					if (begin.state === "in_progress") {
						await logUsage({
							statusCode: 409,
							outcome: "idempotency_in_progress",
							errorCode: "IDEMPOTENCY_IN_PROGRESS",
						});
						return errorResponse({
							code: "IDEMPOTENCY_IN_PROGRESS",
							message: "A request with this Idempotency-Key is in progress.",
							status: 409,
							requestId,
							externalId,
							headers: { ...limitHeaders, "Retry-After": "2" },
						});
					}

					idempotencyRecordId = begin.recordId;
				}

				const { apiKey, baseUrl } = getAiConfig();
				if (!apiKey) {
					if (idempotencyRecordId) {
						await releaseIdempotentRequest(idempotencyRecordId);
					}
					await logUsage({
						statusCode: 503,
						outcome: "ai_unavailable",
						errorCode: "AI_UNAVAILABLE",
					});
					return errorResponse({
						code: "AI_UNAVAILABLE",
						message: "The AI provider is not configured.",
						status: 503,
						requestId,
						externalId,
						headers: limitHeaders,
					});
				}

				const examInput: ExternalExamInput = {
					content: input.content,
					instructions: input.instructions,
					subject: input.subject,
					difficulty: input.difficulty,
					questionCount: input.questionCount,
					questionTypes,
					language: input.language,
					audience: input.audience,
					sourceOnly: input.sourceOnly,
				};

				try {
					const generated = await generateExternalExam({
						input: examInput,
						schema,
						source: schemaSource,
						apiKey,
						baseUrl,
					});
					const responseBody = JSON.stringify(generated.data);

					if (idempotencyRecordId) {
						try {
							await completeIdempotentRequest({
								id: idempotencyRecordId,
								responseStatus: 200,
								responseBody,
								requestId,
								model: generated.model,
								promptTokens: generated.usage.promptTokens,
								completionTokens: generated.usage.completionTokens,
								totalTokens: generated.usage.totalTokens,
							});
						} catch (error: any) {
							console.warn(
								"[API Generate] Failed to complete idempotency record:",
								error?.message,
							);
						}
					}

					await logUsage({
						statusCode: 200,
						outcome: "success",
						model: generated.model,
						promptTokens: generated.usage.promptTokens,
						completionTokens: generated.usage.completionTokens,
						totalTokens: generated.usage.totalTokens,
					});

					return new Response(responseBody, {
						status: 200,
						headers: noStoreHeaders({
							...limitHeaders,
							"X-Gen-Request-Id": requestId,
							"X-Gen-Idempotent-Replay": "false",
							"X-Gen-Model": generated.model,
							"X-Gen-Schema-Source": schemaSource,
							"X-Gen-Usage-Prompt-Tokens": String(generated.usage.promptTokens),
							"X-Gen-Usage-Completion-Tokens": String(
								generated.usage.completionTokens,
							),
							"X-Gen-Usage-Total-Tokens": String(generated.usage.totalTokens),
						}),
					});
				} catch (error: any) {
					if (idempotencyRecordId) {
						await releaseIdempotentRequest(idempotencyRecordId);
					}

					const generationError =
						error instanceof ExternalGenerationError
							? error
							: new ExternalGenerationError({
									code: "INTERNAL_ERROR",
									status: 500,
									message: "An unexpected error occurred.",
								});

					await logUsage({
						statusCode: generationError.status,
						outcome:
							generationError.code === "AI_UNAVAILABLE"
								? "ai_unavailable"
								: generationError.code === "SCHEMA_VALIDATION_FAILED" ||
										generationError.code === "GENERATION_FAILED"
									? "generation_failed"
									: "internal_error",
						errorCode: generationError.code,
						promptTokens: generationError.usage?.promptTokens,
						completionTokens: generationError.usage?.completionTokens,
						totalTokens: generationError.usage?.totalTokens,
					});

					return errorResponse({
						code: generationError.code,
						message: generationError.message,
						status: generationError.status,
						requestId,
						externalId,
						details: generationError.details,
						headers: limitHeaders,
					});
				}
			},
		},
	},
});
