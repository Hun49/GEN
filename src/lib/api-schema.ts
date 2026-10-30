import { Validator } from "@cfworker/json-schema";
import type { ApiErrorDetails } from "#/lib/api-errors";

export const MAX_SCHEMA_CHARS = 16_384;

export type SchemaSource = "default" | "project" | "request";

export interface ResolvedResponseSchema {
	schema: Record<string, unknown>;
	source: SchemaSource;
}

export const DEFAULT_EXAM_SCHEMA: Record<string, unknown> = {
	type: "object",
	additionalProperties: false,
	required: [
		"title",
		"subject",
		"difficulty",
		"description",
		"tags",
		"questionCount",
		"questions",
	],
	properties: {
		title: { type: "string", minLength: 1 },
		subject: { type: "string", minLength: 1 },
		difficulty: { enum: ["easy", "medium", "hard"] },
		description: { type: "string" },
		tags: {
			type: "array",
			items: { type: "string" },
		},
		questionCount: { type: "integer", minimum: 1, maximum: 30 },
		questions: {
			type: "array",
			minItems: 1,
			maxItems: 30,
			items: {
				type: "object",
				additionalProperties: false,
				required: [
					"number",
					"type",
					"question",
					"options",
					"correctAnswer",
					"explanation",
				],
				properties: {
					number: { type: "integer", minimum: 1 },
					type: { enum: ["multiple-choice", "true-false"] },
					question: { type: "string", minLength: 1 },
					options: {
						type: "array",
						minItems: 2,
						maxItems: 4,
						items: {
							type: "object",
							additionalProperties: false,
							required: ["id", "text"],
							properties: {
								id: { type: "string", minLength: 1 },
								text: { type: "string", minLength: 1 },
							},
						},
					},
					correctAnswer: {
						type: "object",
						additionalProperties: false,
						required: ["id", "text"],
						properties: {
							id: { type: "string", minLength: 1 },
							text: { type: "string", minLength: 1 },
						},
					},
					explanation: { type: "string" },
				},
			},
		},
	},
};

export function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
	}

	if (value && typeof value === "object") {
		const record = value as Record<string, unknown>;
		return `{${Object.keys(record)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
			.join(",")}}`;
	}

	return JSON.stringify(value) ?? "null";
}

function schemaDetails(path: string, message: string): ApiErrorDetails {
	return { path, message };
}

function walkSchema(
	value: unknown,
	path: string,
	depth: number,
	details: ApiErrorDetails[],
): void {
	if (details.length >= 10) return;

	if (depth > 32) {
		details.push(schemaDetails(path, "Schema nesting is too deep."));
		return;
	}

	if (Array.isArray(value)) {
		for (let index = 0; index < value.length; index++) {
			walkSchema(value[index], `${path}[${index}]`, depth + 1, details);
		}
		return;
	}

	if (!value || typeof value !== "object") return;

	const record = value as Record<string, unknown>;
	const ref = record.$ref;
	if (typeof ref === "string" && !ref.startsWith("#")) {
		details.push(
			schemaDetails(`${path}.$ref`, "External $ref values are not allowed."),
		);
	}

	for (const [key, child] of Object.entries(record)) {
		walkSchema(child, path ? `${path}.${key}` : key, depth + 1, details);
	}
}

export function validateSchemaDefinition(input: unknown): {
	valid: boolean;
	schema?: Record<string, unknown>;
	details: ApiErrorDetails[];
} {
	if (!input || typeof input !== "object" || Array.isArray(input)) {
		return {
			valid: false,
			details: [
				schemaDetails("responseSchema", "Schema must be a JSON object."),
			],
		};
	}

	let serialized: string;
	try {
		serialized = JSON.stringify(input);
	} catch {
		return {
			valid: false,
			details: [schemaDetails("responseSchema", "Schema must be valid JSON.")],
		};
	}

	if (serialized.length > MAX_SCHEMA_CHARS) {
		return {
			valid: false,
			details: [
				schemaDetails(
					"responseSchema",
					`Schema cannot exceed ${MAX_SCHEMA_CHARS} characters.`,
				),
			],
		};
	}

	const schema = input as Record<string, unknown>;
	if (schema.type !== "object") {
		return {
			valid: false,
			details: [
				schemaDetails(
					"responseSchema.type",
					'The root schema type must be "object".',
				),
			],
		};
	}

	const details: ApiErrorDetails[] = [];
	walkSchema(schema, "responseSchema", 0, details);
	if (details.length > 0) {
		return { valid: false, details };
	}

	try {
		new Validator(schema as any, "2020-12", false);
	} catch (error: any) {
		return {
			valid: false,
			details: [
				schemaDetails(
					"responseSchema",
					error?.message || "Schema could not be compiled.",
				),
			],
		};
	}

	return { valid: true, schema, details: [] };
}

export function parseSchemaText(text: string): {
	valid: boolean;
	schema?: Record<string, unknown>;
	details: ApiErrorDetails[];
} {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return {
			valid: false,
			details: [schemaDetails("responseSchema", "Schema must be valid JSON.")],
		};
	}
	return validateSchemaDefinition(parsed);
}

export function validateAgainstSchema(
	schema: Record<string, unknown>,
	value: unknown,
): { valid: boolean; details: ApiErrorDetails[] } {
	let result: {
		valid: boolean;
		errors: Array<{ error: string; instanceLocation: string }>;
	};
	try {
		result = new Validator(schema as any, "2020-12", false).validate(value);
	} catch (error: any) {
		return {
			valid: false,
			details: [
				schemaDetails(
					"response",
					error?.message || "Generated response could not be validated.",
				),
			],
		};
	}

	if (result.valid) return { valid: true, details: [] };

	return {
		valid: false,
		details: result.errors.slice(0, 10).map((error) => ({
			path: error.instanceLocation || "response",
			message: error.error,
		})),
	};
}

export function resolveResponseSchema({
	requestSchema,
	projectSchemaText,
}: {
	requestSchema: unknown;
	projectSchemaText: string | null;
}): {
	valid: boolean;
	resolved?: ResolvedResponseSchema;
	details: ApiErrorDetails[];
	source: SchemaSource;
} {
	if (requestSchema !== undefined) {
		const result = validateSchemaDefinition(requestSchema);
		return {
			valid: result.valid,
			resolved: result.schema
				? { schema: result.schema, source: "request" }
				: undefined,
			details: result.details,
			source: "request",
		};
	}

	if (projectSchemaText) {
		const result = parseSchemaText(projectSchemaText);
		return {
			valid: result.valid,
			resolved: result.schema
				? { schema: result.schema, source: "project" }
				: undefined,
			details: result.details,
			source: "project",
		};
	}

	return {
		valid: true,
		resolved: { schema: DEFAULT_EXAM_SCHEMA, source: "default" },
		details: [],
		source: "default",
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function validateDefaultExamOutput(value: unknown): {
	valid: boolean;
	details: ApiErrorDetails[];
} {
	if (!isRecord(value)) {
		return {
			valid: false,
			details: [schemaDetails("response", "Response must be a JSON object.")],
		};
	}

	const details: ApiErrorDetails[] = [];
	const questions = value.questions;
	if (!Array.isArray(questions) || questions.length === 0) {
		details.push(
			schemaDetails("questions", "questions must be a non-empty array."),
		);
		return { valid: false, details };
	}

	if (value.questionCount !== questions.length) {
		details.push(
			schemaDetails(
				"questionCount",
				"questionCount must match the number of questions.",
			),
		);
	}

	questions.forEach((question, index) => {
		const path = `questions[${index}]`;
		if (!isRecord(question)) {
			details.push(schemaDetails(path, "Question must be an object."));
			return;
		}

		const type = question.type;
		const options = question.options;
		const correctAnswer = question.correctAnswer;

		if (type !== "multiple-choice" && type !== "true-false") {
			details.push(schemaDetails(`${path}.type`, "Invalid question type."));
			return;
		}

		if (!Array.isArray(options)) {
			details.push(
				schemaDetails(`${path}.options`, "Options must be an array."),
			);
			return;
		}

		if (type === "multiple-choice") {
			const ids = options
				.filter(isRecord)
				.map((option) => option.id)
				.sort();
			if (options.length !== 4 || ids.join(",") !== "A,B,C,D") {
				details.push(
					schemaDetails(
						`${path}.options`,
						"Multiple-choice questions must have options A, B, C, and D.",
					),
				);
			}
		} else {
			const ids = options
				.filter(isRecord)
				.map((option) => option.id)
				.sort();
			if (options.length !== 2 || ids.join(",") !== "F,T") {
				details.push(
					schemaDetails(
						`${path}.options`,
						"True/false questions must have options T and F.",
					),
				);
			}
		}

		if (!isRecord(correctAnswer)) {
			details.push(
				schemaDetails(
					`${path}.correctAnswer`,
					"correctAnswer must be an object.",
				),
			);
			return;
		}

		const matchingOption = options.find(
			(option) =>
				isRecord(option) &&
				option.id === correctAnswer.id &&
				option.text === correctAnswer.text,
		);
		if (!matchingOption) {
			details.push(
				schemaDetails(
					`${path}.correctAnswer`,
					"correctAnswer must match one of the options.",
				),
			);
		}
	});

	return { valid: details.length === 0, details };
}
