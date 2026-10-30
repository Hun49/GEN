import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import {
	apiIdempotency,
	apiKeys,
	apiProjects,
} from "#/db/schema";
import { adminError } from "#/lib/admin-api";
import { bearerHeader, errorResponse, noStoreHeaders } from "#/lib/api-errors";
import {
	ExternalGenerationError,
	generateExternalExam,
} from "#/lib/external-exam";
import {
	beginIdempotentRequest,
	completeIdempotentRequest,
	getIdempotencyKey,
	hashIdempotencyRequest,
	releaseIdempotentRequest,
} from "#/lib/api-idempotency";
import {
	canonicalJson,
	parseSchemaText,
	resolveResponseSchema,
	validateAgainstSchema,
	validateDefaultExamOutput,
	validateSchemaDefinition,
} from "#/lib/api-schema";

const validDefaultExam = {
	title: "Cell Biology Review",
	subject: "Biology",
	difficulty: "medium",
	description: "A short review.",
	tags: ["biology"],
	questionCount: 2,
	questions: [
		{
			number: 1,
			type: "multiple-choice",
			question: "Which organelle performs photosynthesis?",
			options: [
				{ id: "A", text: "Chloroplast" },
				{ id: "B", text: "Mitochondrion" },
				{ id: "C", text: "Nucleus" },
				{ id: "D", text: "Ribosome" },
			],
			correctAnswer: { id: "A", text: "Chloroplast" },
			explanation: "Chloroplasts contain chlorophyll.",
		},
		{
			number: 2,
			type: "true-false",
			question: "Cellular respiration releases energy from glucose.",
			options: [
				{ id: "T", text: "True" },
				{ id: "F", text: "False" },
			],
			correctAnswer: { id: "T", text: "True" },
			explanation: "Respiration converts glucose into usable energy.",
		},
	],
};

const customSchema = {
	type: "object",
	additionalProperties: false,
	required: ["title", "items"],
	properties: {
		title: { type: "string" },
		items: {
			type: "array",
			items: {
				type: "object",
				required: ["question"],
				properties: { question: { type: "string" } },
			},
		},
	},
};

describe("External API schema handling", () => {
	it("uses the built-in schema when no override exists", () => {
		const result = resolveResponseSchema({
			requestSchema: undefined,
			projectSchemaText: null,
		});
		expect(result.valid).toBe(true);
		expect(result.resolved?.source).toBe("default");
	});

	it("gives request schemas precedence over project schemas", () => {
		const result = resolveResponseSchema({
			requestSchema: customSchema,
			projectSchemaText: JSON.stringify({
				type: "object",
				properties: { projectValue: { type: "string" } },
			}),
		});
		expect(result.valid).toBe(true);
		expect(result.resolved?.source).toBe("request");
	});

	it("falls back to project schemas when the request has none", () => {
		const result = resolveResponseSchema({
			requestSchema: undefined,
			projectSchemaText: JSON.stringify(customSchema),
		});
		expect(result.valid).toBe(true);
		expect(result.resolved?.source).toBe("project");
	});

	it("rejects arrays and non-object roots", () => {
		expect(validateSchemaDefinition([]).valid).toBe(false);
		expect(
			validateSchemaDefinition({ type: "array", items: { type: "string" } })
				.valid,
		).toBe(false);
	});

	it("rejects external $ref values and accepts local refs", () => {
		const external = validateSchemaDefinition({
			type: "object",
			properties: {
				value: { $ref: "https://example.com/schema.json" },
			},
		});
		expect(external.valid).toBe(false);

		const local = validateSchemaDefinition({
			type: "object",
			definitions: { value: { type: "string" } },
			properties: {
				value: { $ref: "#/definitions/value" },
			},
		});
		expect(local.valid).toBe(true);
	});

	it("parses schema text and reports JSON errors", () => {
		expect(parseSchemaText("{").valid).toBe(false);
		expect(parseSchemaText(JSON.stringify(customSchema)).valid).toBe(true);
	});

	it("validates custom outputs and rejects missing required fields", () => {
		expect(
			validateAgainstSchema(customSchema, {
				title: "Example",
				items: [{ question: "What is 2 + 2?" }],
			}).valid,
		).toBe(true);
		expect(
			validateAgainstSchema(customSchema, { title: "Example" }).valid,
		).toBe(false);
	});

	it("accepts a valid default exam", () => {
		expect(validateDefaultExamOutput(validDefaultExam).valid).toBe(true);
	});

	it("rejects default exams with incorrect question counts", () => {
		const result = validateDefaultExamOutput({
			...validDefaultExam,
			questionCount: 3,
		});
		expect(result.valid).toBe(false);
		expect(result.details.some((detail) => detail.path === "questionCount")).toBe(
			true,
		);
	});

	it("rejects multiple-choice questions without A-D options", () => {
		const result = validateDefaultExamOutput({
			...validDefaultExam,
			questions: [
				{
					...validDefaultExam.questions[0],
					options: [
						{ id: "A", text: "One" },
						{ id: "B", text: "Two" },
					],
				},
			],
			questionCount: 1,
		});
		expect(result.valid).toBe(false);
	});

	it("canonicalizes object keys consistently", () => {
		expect(canonicalJson({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
		expect(canonicalJson([{ b: 2, a: 1 }])).toBe('[{"a":1,"b":2}]');
	});
});

describe("External API request helpers", () => {
	it("parses bearer tokens", () => {
		expect(
			bearerHeader(
				new Request("http://localhost/api/v1/generate", {
					headers: { Authorization: "Bearer gen_live_test" },
				}),
			),
		).toBe("gen_live_test");
		expect(
			bearerHeader(new Request("http://localhost/api/v1/generate")),
		).toBe(null);
	});

	it("validates idempotency keys", () => {
		const makeRequest = (value: string) =>
			new Request("http://localhost/api/v1/generate", {
				headers: { "Idempotency-Key": value },
			});

		expect(getIdempotencyKey(makeRequest("valid-key_1")).key).toBe("valid-key_1");
		expect(getIdempotencyKey(makeRequest("bad key!")).valid).toBe(false);
		expect(getIdempotencyKey(makeRequest("a".repeat(129))).valid).toBe(false);
	});

	it("returns error envelopes with no-store headers", () => {
		const response = errorResponse({
			code: "VALIDATION_ERROR",
			message: "Invalid request.",
			status: 400,
			requestId: "req_test",
		});
		expect(response.status).toBe(400);
		expect(response.headers.get("X-Gen-Request-Id")).toBe("req_test");
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(noStoreHeaders()["Content-Type"]).toBe("application/json");
	});

	it("returns admin error envelopes with custom headers", () => {
		const response = adminError({
			code: "INTERNAL_ERROR",
			message: "Admin request failed.",
			status: 500,
			headers: { "Retry-After": "2" },
		});
		expect(response.status).toBe(500);
		expect(response.headers.get("Retry-After")).toBe("2");
		expect(response.headers.get("X-Gen-Request-Id")).toMatch(/^req_/);
	});
});

describe("Idempotency persistence", () => {
	const runId = Math.random().toString(36).slice(2, 8);
	const projectId = `prj_idem_${runId}`;
	const keyId = `key_idem_${runId}`;
	const idempotencyKey = `idem-key-${runId}`;

	beforeAll(async () => {
		await db.insert(apiProjects).values({
			id: projectId,
			name: `Idempotency Test ${runId}`,
			status: "active",
		});
		await db.insert(apiKeys).values({
			id: keyId,
			projectId,
			name: "Test key",
			keyHash: `hash_${runId}`,
			keyPrefix: "gen_live_test",
			lastFour: "test",
		});
	});

	afterAll(async () => {
		await db.delete(apiIdempotency).where(eq(apiIdempotency.projectId, projectId));
		await db.delete(apiKeys).where(eq(apiKeys.projectId, projectId));
		await db.delete(apiProjects).where(eq(apiProjects.id, projectId));
	});

	it("replays a completed request and rejects a different body", async () => {
		const requestHash = await hashIdempotencyRequest(
			{ content: "source", questionCount: 2 },
			customSchema,
		);
		const begin = await beginIdempotentRequest({
			projectId,
			keyId,
			idempotencyKey,
			requestHash,
			requestId: "req_first",
		});
		expect(begin.state).toBe("new");
		if (begin.state !== "new") throw new Error("Expected new record");

		await completeIdempotentRequest({
			id: begin.recordId,
			responseStatus: 200,
			responseBody: '{"title":"Replay","items":[]}',
			requestId: "req_first",
			model: "test-model",
			promptTokens: 10,
			completionTokens: 20,
			totalTokens: 30,
		});

		const replay = await beginIdempotentRequest({
			projectId,
			keyId,
			idempotencyKey,
			requestHash,
			requestId: "req_second",
		});
		expect(replay.state).toBe("replay");
		if (replay.state === "replay") {
			expect(replay.record.responseBody).toBe('{"title":"Replay","items":[]}');
			expect(replay.record.totalTokens).toBe(30);
		}

		const conflict = await beginIdempotentRequest({
			projectId,
			keyId,
			idempotencyKey,
			requestHash: await hashIdempotencyRequest(
				{ content: "different" },
				customSchema,
			),
			requestId: "req_third",
		});
		expect(conflict.state).toBe("conflict");
	});

	it("replaces a stale in-progress request", async () => {
		const staleKey = `stale-${runId}`;
		const requestHash = await hashIdempotencyRequest(
			{ content: "stale" },
			customSchema,
		);
		const begin = await beginIdempotentRequest({
			projectId,
			keyId,
			idempotencyKey: staleKey,
			requestHash,
			requestId: "req_stale",
		});
		if (begin.state !== "new") throw new Error("Expected new record");

		await db
			.update(apiIdempotency)
			.set({ createdAt: new Date(Date.now() - 5 * 60 * 1000) })
			.where(eq(apiIdempotency.id, begin.recordId));

		const retry = await beginIdempotentRequest({
			projectId,
			keyId,
			idempotencyKey: staleKey,
			requestHash,
			requestId: "req_stale_retry",
		});
		expect(retry.state).toBe("new");
		if (retry.state === "new") {
			expect(retry.recordId).toBe(begin.recordId);
			await releaseIdempotentRequest(retry.recordId);
		}
	});
});

describe("External exam generation", () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	const input = {
		content: "Photosynthesis converts light into chemical energy.",
		questionCount: 1,
		questionTypes: ["multiple-choice" as const],
		difficulty: "medium" as const,
		language: "English",
		sourceOnly: true,
	};

	function completion(content: string, usage = {}) {
		return {
			ok: true,
			json: async () => ({
				choices: [{ message: { content } }],
				usage: {
					prompt_tokens: 100,
					completion_tokens: 50,
					total_tokens: 150,
					...usage,
				},
			}),
		};
	}

	it("returns a custom schema response without the default exam wrapper", async () => {
		globalThis.fetch = vi
			.fn()
			.mockResolvedValueOnce(completion('{"title":"Custom","items":[]}'));

		const result = await generateExternalExam({
			input,
			schema: customSchema,
			source: "request",
			apiKey: "test",
			baseUrl: "https://ai.test",
		});

		expect(result.data).toEqual({ title: "Custom", items: [] });
		expect(result.usage.totalTokens).toBe(150);
	});

	it("repairs an invalid response once and returns the repaired object", async () => {
		globalThis.fetch = vi
			.fn()
			.mockResolvedValueOnce(completion('{"title":"Missing items"}'))
			.mockResolvedValueOnce(
				completion('{"title":"Repaired","items":[]}', {
					prompt_tokens: 120,
					completion_tokens: 60,
					total_tokens: 180,
				}),
			);

		const result = await generateExternalExam({
			input,
			schema: customSchema,
			source: "request",
			apiKey: "test",
			baseUrl: "https://ai.test",
		});

		expect(result.data).toEqual({ title: "Repaired", items: [] });
		expect(result.usage.totalTokens).toBe(330);
	});

	it("fails with SCHEMA_VALIDATION_FAILED after the repair attempt", async () => {
		globalThis.fetch = vi
			.fn()
			.mockResolvedValueOnce(completion('{"title":"Missing items"}'))
			.mockResolvedValueOnce(completion('{"title":"Still missing"}'));

		await expect(
			generateExternalExam({
				input,
				schema: customSchema,
				source: "request",
				apiKey: "test",
				baseUrl: "https://ai.test",
			}),
		).rejects.toMatchObject<Partial<ExternalGenerationError>>({
			code: "SCHEMA_VALIDATION_FAILED",
			status: 502,
		});
	});
});
