import { afterEach, describe, expect, it, vi } from "vitest";
import {
	CANDIDATE_MODELS,
	cleanJsonOutput,
	executeAiCompletion,
} from "#/lib/ai";

describe("AI Engine & Model Fallback Hierarchy", () => {
	it("verifies CANDIDATE_MODELS has the correct empirical priority ordering", () => {
		expect(CANDIDATE_MODELS[0]).toBe("qwen/qwen3.8-27b");
		expect(CANDIDATE_MODELS[1]).toBe("openai/gpt-oss-20b");
		expect(CANDIDATE_MODELS[2]).toBe("openai/gpt-oss-120b");
	});

	describe("cleanJsonOutput", () => {
		it("strips standard json markdown code fences", () => {
			const raw = '```json\n{"title": "Test Exam", "questions": []}\n```';
			expect(cleanJsonOutput(raw)).toBe('{"title": "Test Exam", "questions": []}');
		});

		it("strips untyped markdown code fences", () => {
			const raw = '```\n{"result": true}\n```';
			expect(cleanJsonOutput(raw)).toBe('{"result": true}');
		});

		it("leaves pure json unchanged", () => {
			const raw = '{"valid": true}';
			expect(cleanJsonOutput(raw)).toBe('{"valid": true}');
		});

		it("trims surrounding whitespace properly", () => {
			const raw = '   \n  {"key": "value"}  \n\t ';
			expect(cleanJsonOutput(raw)).toBe('{"key": "value"}');
		});
	});

	describe("executeAiCompletion", () => {
		const originalFetch = globalThis.fetch;

		afterEach(() => {
			globalThis.fetch = originalFetch;
		});

		it("succeeds on first candidate model when response is ok", async () => {
			globalThis.fetch = vi.fn().mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					choices: [
						{
							message: {
								content: '{"title": "Exam 1"}',
							},
						},
					],
				}),
			});

			const result = await executeAiCompletion({
				apiKey: "test-key",
				messages: [{ role: "user", content: "Generate" }],
				jsonMode: true,
			});

			expect(result.content).toBe('{"title": "Exam 1"}');
			expect(result.modelUsed).toBe("qwen/qwen3.8-27b");
			expect(globalThis.fetch).toHaveBeenCalledTimes(1);
		});

		it("falls back to second candidate model when first candidate fails with 400/429", async () => {
			globalThis.fetch = vi
				.fn()
				.mockResolvedValueOnce({
					ok: false,
					status: 400,
					text: async () => "json_validate_failed",
				})
				.mockResolvedValueOnce({
					ok: true,
					json: async () => ({
						choices: [
							{
								message: {
									content: '{"title": "Fallback Exam"}',
								},
							},
						],
					}),
				});

			const result = await executeAiCompletion({
				apiKey: "test-key",
				messages: [{ role: "user", content: "Generate" }],
				jsonMode: true,
			});

			expect(result.content).toBe('{"title": "Fallback Exam"}');
			expect(result.modelUsed).toBe("openai/gpt-oss-20b");
			expect(globalThis.fetch).toHaveBeenCalledTimes(2);
		});

		it("throws informative error when all candidate models fail", async () => {
			globalThis.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				text: async () => "Internal server error",
			});

			await expect(
				executeAiCompletion({
					apiKey: "test-key",
					messages: [{ role: "user", content: "Generate" }],
					models: ["qwen/qwen3.8-27b", "groq/compound-mini"],
				}),
			).rejects.toThrow(/AI generation failed across all available models/);
		});
	});
});
