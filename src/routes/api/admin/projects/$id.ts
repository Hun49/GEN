import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { apiKeys, apiProjects } from "#/db/schema";
import {
	adminError,
	adminJson,
	readAdminJson,
	requireAdmin,
} from "#/lib/admin-api";
import { toPublicApiKey } from "#/lib/api-keys";
import { MAX_SCHEMA_CHARS, parseSchemaText } from "#/lib/api-schema";
import { getProjectUsage, parseUsageRange } from "#/lib/api-usage";

const UpdateProjectSchema = z
	.object({
		name: z.string().trim().min(1).max(80).optional(),
		description: z.string().trim().max(240).nullable().optional(),
		status: z.enum(["active", "disabled"]).optional(),
		requestsPerMinute: z.number().int().min(1).max(1_000).optional(),
		requestsPerDay: z.number().int().min(1).max(100_000).optional(),
		tokensPerDay: z.number().int().min(1).max(100_000_000).optional(),
		defaultResponseSchema: z
			.string()
			.max(MAX_SCHEMA_CHARS)
			.nullable()
			.optional(),
	})
	.strict();

export const Route = createFileRoute("/api/admin/projects/$id")({
	server: {
		handlers: {
			GET: async ({ request, params }) => {
				const auth = await requireAdmin(request);
				if (!auth.ok) return auth.response;

				const project = await db
					.select()
					.from(apiProjects)
					.where(eq(apiProjects.id, params.id))
					.get();

				if (!project) {
					return adminError({
						code: "NOT_FOUND",
						message: "Project not found.",
						status: 404,
					});
				}

				const keys = await db
					.select()
					.from(apiKeys)
					.where(eq(apiKeys.projectId, project.id))
					.orderBy(desc(apiKeys.createdAt));

				const range = parseUsageRange(
					new URL(request.url).searchParams.get("range"),
				);
				const usage = await getProjectUsage(project.id, range);

				return adminJson({
					project,
					keys: keys.map(toPublicApiKey),
					usage,
					range,
				});
			},

			PATCH: async ({ request, params }) => {
				const auth = await requireAdmin(request, { mutation: true });
				if (!auth.ok) return auth.response;

				const parsedBody = await readAdminJson(request);
				if (!parsedBody.ok) return parsedBody.response;

				const parsed = UpdateProjectSchema.safeParse(parsedBody.body);
				if (!parsed.success) {
					return adminError({
						code: "VALIDATION_ERROR",
						message: "Project update is invalid.",
						status: 400,
						details: parsed.error.issues.slice(0, 10).map((issue) => ({
							path: issue.path.join("."),
							message: issue.message,
						})),
					});
				}

				const existing = await db
					.select()
					.from(apiProjects)
					.where(eq(apiProjects.id, params.id))
					.get();

				if (!existing) {
					return adminError({
						code: "NOT_FOUND",
						message: "Project not found.",
						status: 404,
					});
				}

				const updates: Record<string, unknown> = {};
				const data = parsed.data;

				if (data.name !== undefined) updates.name = data.name;
				if (data.description !== undefined) {
					updates.description = data.description || null;
				}
				if (data.status !== undefined) updates.status = data.status;
				if (data.requestsPerMinute !== undefined) {
					updates.requestsPerMinute = data.requestsPerMinute;
				}
				if (data.requestsPerDay !== undefined) {
					updates.requestsPerDay = data.requestsPerDay;
				}
				if (data.tokensPerDay !== undefined) {
					updates.tokensPerDay = data.tokensPerDay;
				}

				if (data.defaultResponseSchema !== undefined) {
					const text = data.defaultResponseSchema?.trim();
					if (!text) {
						updates.defaultResponseSchema = null;
					} else {
						const validated = parseSchemaText(text);
						if (!validated.valid) {
							return adminError({
								code: "INVALID_RESPONSE_SCHEMA",
								message: "Default response schema is invalid.",
								status: 400,
								details: validated.details,
							});
						}
						updates.defaultResponseSchema = text;
					}
				}

				if (Object.keys(updates).length === 0) {
					return adminError({
						code: "VALIDATION_ERROR",
						message: "No project fields to update.",
						status: 400,
					});
				}

				updates.updatedAt = new Date();

				try {
					const project = await db
						.update(apiProjects)
						.set(updates)
						.where(eq(apiProjects.id, params.id))
						.returning()
						.get();

					return adminJson({ project });
				} catch (error: any) {
					const message = String(error?.message || "").toLowerCase();
					if (message.includes("unique")) {
						return adminError({
							code: "CONFLICT",
							message: "A project with that name already exists.",
							status: 409,
						});
					}
					console.error("[Admin API] Update project failed:", error?.message);
					return adminError({
						code: "INTERNAL_ERROR",
						message: "Unable to update project.",
						status: 500,
					});
				}
			},
		},
	},
});
