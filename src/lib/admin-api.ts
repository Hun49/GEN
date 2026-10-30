import { getAdminSession, isSameOriginRequest } from "#/lib/admin-auth";
import type { ApiErrorCode } from "#/lib/api-errors";
import { createRequestId, errorResponse, jsonResponse } from "#/lib/api-errors";

export async function requireAdmin(
	request: Request,
	options: { mutation?: boolean } = {},
): Promise<
	| { ok: true; session: { id: string; expiresAt: Date } }
	| { ok: false; response: Response }
> {
	const requestId = createRequestId();
	const session = await getAdminSession(request);
	if (!session) {
		return {
			ok: false,
			response: errorResponse({
				code: "UNAUTHORIZED",
				message: "Admin authentication required.",
				status: 401,
				requestId,
			}),
		};
	}

	if (options.mutation && !isSameOriginRequest(request)) {
		return {
			ok: false,
			response: errorResponse({
				code: "UNAUTHORIZED",
				message: "Invalid request origin.",
				status: 403,
				requestId,
			}),
		};
	}

	return { ok: true, session };
}

export function adminJson(
	body: unknown,
	status = 200,
	headers: Record<string, string> = {},
): Response {
	return jsonResponse(body, status, headers);
}

export function adminError({
	code,
	message,
	status,
	details,
	headers,
}: {
	code: ApiErrorCode;
	message: string;
	status: number;
	details?: Array<{ path?: string; message: string }>;
	headers?: Record<string, string>;
}): Response {
	return errorResponse({
		code,
		message,
		status,
		requestId: createRequestId(),
		details,
		headers,
	});
}

export async function readAdminJson(
	request: Request,
): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
	try {
		return { ok: true, body: await request.json() };
	} catch {
		return {
			ok: false,
			response: adminError({
				code: "VALIDATION_ERROR",
				message: "Request body must be valid JSON.",
				status: 400,
			}),
		};
	}
}
