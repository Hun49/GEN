export type ApiErrorCode =
	| "VALIDATION_ERROR"
	| "INVALID_RESPONSE_SCHEMA"
	| "SCHEMA_VALIDATION_FAILED"
	| "INVALID_API_KEY"
	| "KEY_REVOKED"
	| "PROJECT_DISABLED"
	| "CONTENT_TOO_LARGE"
	| "RATE_LIMITED"
	| "QUOTA_EXCEEDED"
	| "IDEMPOTENCY_CONFLICT"
	| "IDEMPOTENCY_IN_PROGRESS"
	| "GENERATION_FAILED"
	| "AI_UNAVAILABLE"
	| "INTERNAL_ERROR"
	| "UNAUTHORIZED"
	| "NOT_FOUND"
	| "CONFLICT";

export interface ApiErrorDetails {
	path?: string;
	message: string;
}

export interface ApiErrorBody {
	success: false;
	requestId: string;
	externalId?: string;
	error: {
		code: ApiErrorCode;
		message: string;
		details?: ApiErrorDetails[];
	};
}

export function createRequestId(): string {
	return `req_${crypto.randomUUID()}`;
}

export function noStoreHeaders(
	extra: Record<string, string> = {},
): Record<string, string> {
	return {
		"Cache-Control": "no-store",
		"Content-Type": "application/json",
		"X-Content-Type-Options": "nosniff",
		...extra,
	};
}

export function jsonResponse(
	body: unknown,
	status = 200,
	headers: Record<string, string> = {},
): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: noStoreHeaders(headers),
	});
}

export function errorResponse({
	code,
	message,
	status,
	requestId,
	externalId,
	details,
	headers = {},
}: {
	code: ApiErrorCode;
	message: string;
	status: number;
	requestId: string;
	externalId?: string;
	details?: ApiErrorDetails[];
	headers?: Record<string, string>;
}): Response {
	const body: ApiErrorBody = {
		success: false,
		requestId,
		...(externalId ? { externalId } : {}),
		error: {
			code,
			message,
			...(details && details.length > 0 ? { details } : {}),
		},
	};

	return jsonResponse(body, status, {
		"X-Gen-Request-Id": requestId,
		...headers,
	});
}

export function bearerHeader(request: Request): string | null {
	const header = request.headers.get("authorization");
	if (!header) return null;
	const [scheme, token] = header.split(/\s+/, 2);
	if (scheme?.toLowerCase() !== "bearer" || !token) return null;
	return token.trim() || null;
}

export function getClientIp(request: Request): string | null {
	return (
		request.headers.get("cf-connecting-ip") ||
		request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
		null
	);
}
