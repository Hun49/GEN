import { executeAiCompletion, type TokenUsage } from "#/lib/ai";
import type { ApiErrorCode, ApiErrorDetails } from "#/lib/api-errors";
import {
	type SchemaSource,
	validateAgainstSchema,
	validateDefaultExamOutput,
} from "#/lib/api-schema";

export interface ExternalExamInput {
	content: string;
	instructions?: string;
	subject?: string;
	difficulty: "easy" | "medium" | "hard";
	questionCount: number;
	questionTypes: Array<"multiple-choice" | "true-false">;
	language: string;
	audience?: string;
	sourceOnly: boolean;
}

export class ExternalGenerationError extends Error {
	code: ApiErrorCode;
	status: number;
	details?: ApiErrorDetails[];
	usage?: TokenUsage;

	constructor({
		code,
		status,
		message,
		details,
		usage,
	}: {
		code: ApiErrorCode;
		status: number;
		message: string;
		details?: ApiErrorDetails[];
		usage?: TokenUsage;
	}) {
		super(message);
		this.name = "ExternalGenerationError";
		this.code = code;
		this.status = status;
		this.details = details;
		this.usage = usage;
	}
}

function addUsage(left: TokenUsage, right: TokenUsage): TokenUsage {
	return {
		promptTokens: left.promptTokens + right.promptTokens,
		completionTokens: left.completionTokens + right.completionTokens,
		totalTokens: left.totalTokens + right.totalTokens,
	};
}

function buildMessages({
	input,
	schema,
}: {
	input: ExternalExamInput;
	schema: Record<string, unknown>;
}) {
	const schemaText = JSON.stringify(schema, null, 2);
	const typeLabel = input.questionTypes.join(" and ");
	const systemPrompt = `You are an expert exam generator. Generate only multiple-choice and true-false questions.

Return ONLY one valid JSON object that validates against this JSON Schema:
${schemaText}

RULES:
1. The response must be pure JSON with no markdown fences, comments, or explanation.
2. Every question must be either "multiple-choice" or "true-false". Never generate short-answer, essay, or open-ended questions.
3. Multiple-choice questions must have exactly four options identified as A, B, C, and D.
4. True-false questions must have exactly the options T and F with the texts "True" and "False".
5. The correct answer must match one of the options exactly.
6. Generate exactly ${input.questionCount} questions when the schema contains a questions array.
7. Respect additionalProperties and required fields in the schema exactly.
8. Use ${input.language} for all generated content.
9. Difficulty must be ${input.difficulty}.
${input.subject ? `10. The subject is ${input.subject}.` : "10. Infer the most appropriate academic subject from the source."}
${input.audience ? `11. Write for this audience: ${input.audience}.` : ""}
${
	input.sourceOnly
		? "12. Every question and answer must be grounded strictly in the supplied source material. Do not invent facts."
		: "12. You may use accurate general knowledge in addition to the supplied source material."
}
${input.instructions ? `13. Follow these additional instructions: ${input.instructions}` : ""}`;

	const userPrompt = `SOURCE MATERIAL:
"""
${input.content}
"""

TARGET:
- Question count: ${input.questionCount}
- Question types: ${typeLabel}
- Difficulty: ${input.difficulty}
- Language: ${input.language}
${input.subject ? `- Subject: ${input.subject}` : "- Subject: auto-detect"}
${input.audience ? `- Audience: ${input.audience}` : ""}

Return the completed JSON object now.`;

	return [
		{ role: "system" as const, content: systemPrompt },
		{ role: "user" as const, content: userPrompt },
	];
}

function parseAndValidate({
	content,
	schema,
	source,
}: {
	content: string;
	schema: Record<string, unknown>;
	source: SchemaSource;
}):
	| { valid: true; data: unknown }
	| { valid: false; details: ApiErrorDetails[] } {
	let parsed: unknown;
	try {
		parsed = JSON.parse(content);
	} catch {
		return {
			valid: false,
			details: [
				{ path: "response", message: "Generated output was not valid JSON." },
			],
		};
	}

	const schemaResult = validateAgainstSchema(schema, parsed);
	if (!schemaResult.valid) {
		return { valid: false, details: schemaResult.details };
	}

	if (source === "default") {
		const defaultResult = validateDefaultExamOutput(parsed);
		if (!defaultResult.valid) {
			return { valid: false, details: defaultResult.details };
		}
	}

	return { valid: true, data: parsed };
}

function errorSummary(details: ApiErrorDetails[]): string {
	return details
		.slice(0, 8)
		.map((detail) => `${detail.path}: ${detail.message}`)
		.join("\n");
}

export async function generateExternalExam({
	input,
	schema,
	source,
	apiKey,
	baseUrl,
}: {
	input: ExternalExamInput;
	schema: Record<string, unknown>;
	source: SchemaSource;
	apiKey: string;
	baseUrl: string;
}): Promise<{ data: unknown; model: string; usage: TokenUsage }> {
	const messages = buildMessages({ input, schema });
	let completion: Awaited<ReturnType<typeof executeAiCompletion>>;

	try {
		completion = await executeAiCompletion({
			apiKey,
			baseUrl,
			messages,
			jsonMode: true,
			temperature: 0.4,
			maxTokens: 8192,
			timeoutMs: 20_000,
		});
	} catch (error: any) {
		throw new ExternalGenerationError({
			code: "AI_UNAVAILABLE",
			status: 503,
			message: error?.message || "The AI provider is unavailable.",
		});
	}

	const firstResult = parseAndValidate({
		content: completion.content,
		schema,
		source,
	});
	if (firstResult.valid) {
		return {
			data: firstResult.data,
			model: completion.modelUsed,
			usage: completion.usage,
		};
	}

	const repairMessages = [
		...messages,
		{
			role: "assistant" as const,
			content: completion.content,
		},
		{
			role: "user" as const,
			content: `Your response did not match the required schema. Fix these validation errors and return ONLY corrected JSON:\n${errorSummary(firstResult.details)}`,
		},
	];

	let repair: Awaited<ReturnType<typeof executeAiCompletion>>;
	try {
		repair = await executeAiCompletion({
			apiKey,
			baseUrl,
			messages: repairMessages,
			jsonMode: true,
			temperature: 0.2,
			maxTokens: 8192,
			timeoutMs: 20_000,
		});
	} catch (error: any) {
		throw new ExternalGenerationError({
			code: "AI_UNAVAILABLE",
			status: 503,
			message: error?.message || "The AI provider is unavailable.",
			usage: completion.usage,
		});
	}

	const usage = addUsage(completion.usage, repair.usage);
	const secondResult = parseAndValidate({
		content: repair.content,
		schema,
		source,
	});
	if (!secondResult.valid) {
		throw new ExternalGenerationError({
			code: "SCHEMA_VALIDATION_FAILED",
			status: 502,
			message: "Generated exam did not match the response schema.",
			details: secondResult.details,
			usage,
		});
	}

	return {
		data: secondResult.data,
		model: repair.modelUsed,
		usage,
	};
}
