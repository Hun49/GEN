/**
 * AI Engine module for Groq API integration.
 * Centralizes model fallback hierarchy, request timeouts, and response sanitization.
 */

/**
 * Ranked AI model candidates for Groq API.
 * Ordered by empirical latency, JSON compliance, and reliability:
 * 1. qwen/qwen3.8-27b - Primary: Highest schema accuracy and low latency (~1.5s).
 * 2. openai/gpt-oss-20b - Lightweight fallback (~1.1s).
 * 3. openai/gpt-oss-120b - Heavyweight reasoning fallback.
 */
export const CANDIDATE_MODELS = [
	"qwen/qwen3.8-27b",
	"openai/gpt-oss-20b",
	"openai/gpt-oss-120b",
] as const;

export type CandidateModel = (typeof CANDIDATE_MODELS)[number];

/**
 * Strips markdown code fences (```json ... ```) that some LLMs emit
 * even when json_object response mode is requested.
 */
export function cleanJsonOutput(raw: string): string {
	return raw
		.replace(/^\s*```(?:json)?\s*/i, "")
		.replace(/\s*```\s*$/i, "")
		.trim();
}

export interface ChatCompletionOptions {
	apiKey: string;
	baseUrl?: string;
	messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
	jsonMode?: boolean;
	temperature?: number;
	maxTokens?: number;
	timeoutMs?: number;
	models?: readonly string[];
}

export interface TokenUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

export interface ChatCompletionResult {
	content: string;
	modelUsed: string;
	usage: TokenUsage;
}

function readUsage(data: any): TokenUsage {
	const usage = data?.usage ?? {};
	const promptTokens = Number(usage.prompt_tokens || 0);
	const completionTokens = Number(usage.completion_tokens || 0);
	return {
		promptTokens,
		completionTokens,
		totalTokens: Number(usage.total_tokens || promptTokens + completionTokens),
	};
}

/**
 * Executes a chat completion request with automatic model fallback cascade
 * and per-attempt timeout limits.
 */
export async function executeAiCompletion(
	options: ChatCompletionOptions,
): Promise<ChatCompletionResult> {
	const {
		apiKey,
		baseUrl = "https://api.groq.com/openai/v1",
		messages,
		jsonMode = false,
		temperature = 0.5,
		maxTokens = 8192,
		timeoutMs = 15000,
		models = CANDIDATE_MODELS,
	} = options;

	let lastError = "AI provider failed across all candidate models.";

	for (const model of models) {
		try {
			console.log(`[AI Engine] Attempting completion with model: ${model}`);
			const response = await fetch(`${baseUrl}/chat/completions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model,
					messages,
					...(jsonMode ? { response_format: { type: "json_object" } } : {}),
					temperature,
					max_tokens: maxTokens,
				}),
				signal: AbortSignal.timeout(timeoutMs),
			});

			if (!response.ok) {
				const errText = await response.text();
				console.warn(
					`[AI Engine] Model ${model} failed (${response.status}):`,
					errText,
				);
				lastError = `Model ${model} (${response.status}): ${errText}`;
				continue;
			}

			const data: any = await response.json();
			const rawContent = data.choices?.[0]?.message?.content;
			if (!rawContent) {
				console.warn(`[AI Engine] Model ${model} returned empty content`);
				continue;
			}

			return {
				content: jsonMode ? cleanJsonOutput(rawContent) : rawContent,
				modelUsed: model,
				usage: readUsage(data),
			};
		} catch (err: any) {
			const isTimeout =
				err.name === "TimeoutError" || err.name === "AbortError";
			const msg = isTimeout
				? `Request timed out after ${timeoutMs}ms`
				: err.message;
			console.warn(`[AI Engine] Error with model ${model}:`, msg);
			lastError = msg || lastError;
		}
	}

	throw new Error(
		`AI generation failed across all available models. Last error: ${lastError}`,
	);
}
