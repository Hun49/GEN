import { createFileRoute } from "@tanstack/react-router";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { apiKeys, apiProjects } from "#/db/schema";
import {
	adminError,
	adminJson,
	readAdminJson,
	requireAdmin,
} from "#/lib/admin-api";

const CreateProjectSchema = z
	.object({
		name: z.string().trim().min(1).max(80),
		description: z.string().trim().max(240).optional(),
	})
	.strict();

export const Route = createFileRoute("/api/admin/projects/")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const auth = await requireAdmin(request);
				if (!auth.ok) return auth.response;

				const rows = await db
					.select({
						project: apiProjects,
						keyCount: sql<number>`sum(case when ${apiKeys.revokedAt} is null then 1 else 0 end)`,
					})
					.from(apiProjects)
					.leftJoin(apiKeys, eq(apiKeys.projectId, apiProjects.id))
					.groupBy(apiProjects.id)
					.orderBy(desc(apiProjects.createdAt));

				return adminJson({
					projects: rows.map((row) => ({
						...row.project,
						keyCount: Number(row.keyCount || 0),
					})),
				});
			},

			POST: async ({ request }) => {
				const auth = await requireAdmin(request, { mutation: true });
				if (!auth.ok) return auth.response;

				const parsedBody = await readAdminJson(request);
				if (!parsedBody.ok) return parsedBody.response;

				const parsed = CreateProjectSchema.safeParse(parsedBody.body);
				if (!parsed.success) {
					return adminError({
						code: "VALIDATION_ERROR",
						message: "Project name is required.",
						status: 400,
					});
				}

				const now = new Date();
				const project = {
					id: `prj_${crypto.randomUUID()}`,
					name: parsed.data.name,
					description: parsed.data.description || null,
					status: "active" as const,
					defaultResponseSchema: null,
					requestsPerMinute: 10,
					requestsPerDay: 100,
					tokensPerDay: 150_000,
					createdAt: now,
					updatedAt: now,
				};

				try {
					await db.insert(apiProjects).values(project);
				} catch (error: any) {
					const message = String(error?.message || "").toLowerCase();
					if (message.includes("unique")) {
						return adminError({
							code: "CONFLICT",
							message: "A project with that name already exists.",
							status: 409,
						});
					}
					console.error("[Admin API] Create project failed:", error?.message);
					return adminError({
						code: "INTERNAL_ERROR",
						message: "Unable to create project.",
						status: 500,
					});
				}

				return adminJson({ project }, 201);
			},
		},
	},
});
