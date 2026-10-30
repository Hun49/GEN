import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { adminError, adminJson, readAdminJson } from "#/lib/admin-api";
import {
	AdminAuthConfigError,
	adminSessionCookie,
	checkAdminLoginLimit,
	clearAdminLoginFailures,
	clearAdminSessionCookie,
	createAdminSession,
	deleteAdminSession,
	getAdminClientIp,
	getAdminSession,
	isAdminConfigured,
	isSameOriginRequest,
	isSecureRequest,
	recordAdminLoginFailure,
	verifyAdminPassword,
} from "#/lib/admin-auth";

const LoginSchema = z
	.object({
		password: z.string().min(1).max(256),
	})
	.strict();

export const Route = createFileRoute("/api/admin/session")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const session = await getAdminSession(request);
				return adminJson({
					authenticated: Boolean(session),
					configured: isAdminConfigured(),
					...(session
						? { expiresAt: new Date(session.expiresAt).toISOString() }
						: {}),
				});
			},

			POST: async ({ request }) => {
				if (!isSameOriginRequest(request)) {
					return adminError({
						code: "UNAUTHORIZED",
						message: "Invalid request origin.",
						status: 403,
					});
				}

				if (!isAdminConfigured()) {
					return adminError({
						code: "INTERNAL_ERROR",
						message: "ADMIN_PASSWORD_HASH is not configured.",
						status: 503,
					});
				}

				const ip = getAdminClientIp(request);
				const limit = await checkAdminLoginLimit(ip);
				if (!limit.allowed) {
					return adminError({
						code: "RATE_LIMITED",
						message: "Too many failed login attempts. Try again later.",
						status: 429,
						headers: limit.retryAfterSeconds
							? { "Retry-After": String(limit.retryAfterSeconds) }
							: undefined,
					});
				}

				const parsedBody = await readAdminJson(request);
				if (!parsedBody.ok) return parsedBody.response;

				const parsed = LoginSchema.safeParse(parsedBody.body);
				if (!parsed.success) {
					return adminError({
						code: "VALIDATION_ERROR",
						message: "Password is required.",
						status: 400,
					});
				}

				let valid = false;
				try {
					valid = await verifyAdminPassword(parsed.data.password);
				} catch (error: any) {
					if (error instanceof AdminAuthConfigError) {
						return adminError({
							code: "INTERNAL_ERROR",
							message: "ADMIN_PASSWORD_HASH is not configured.",
							status: 503,
						});
					}
					throw error;
				}

				if (!valid) {
					await recordAdminLoginFailure(ip);
					return adminError({
						code: "UNAUTHORIZED",
						message: "Invalid admin password.",
						status: 401,
					});
				}

				await clearAdminLoginFailures(ip);
				const session = await createAdminSession();
				return adminJson(
					{
						authenticated: true,
						expiresAt: session.expiresAt.toISOString(),
					},
					200,
					{
						"Set-Cookie": adminSessionCookie(
							session.token,
							isSecureRequest(request),
						),
					},
				);
			},

			DELETE: async ({ request }) => {
				if (!isSameOriginRequest(request)) {
					return adminError({
						code: "UNAUTHORIZED",
						message: "Invalid request origin.",
						status: 403,
					});
				}

				await deleteAdminSession(request);
				return adminJson({ authenticated: false }, 200, {
					"Set-Cookie": clearAdminSessionCookie(isSecureRequest(request)),
				});
			},
		},
	},
});
