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
import { createApiKeyRecord, toPublicApiKey } from "#/lib/api-keys";

const CreateKeySchema = z
	.object({
		name: z.string().trim().max(80).optional(),
	})
	.strict();

export const Route = createFileRoute("/api/admin/projects/$id/keys")({
	server: {
		handlers: {
			GET: async ({ request, params }) => {
				const auth = await requireAdmin(request);
				if (!auth.ok) return auth.response;

				const project = await db
					.select({ id: apiProjects.id })
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
					.where(eq(apiKeys.projectId, params.id))
					.orderBy(desc(apiKeys.createdAt));

				return adminJson({ keys: keys.map(toPublicApiKey) });
			},

			POST: async ({ request, params }) => {
				const auth = await requireAdmin(request, { mutation: true });
				if (!auth.ok) return auth.response;

				const project = await db
					.select({ id: apiProjects.id })
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

				const parsedBody = await readAdminJson(request);
				if (!parsedBody.ok) return parsedBody.response;

				const parsed = CreateKeySchema.safeParse(parsedBody.body);
				if (!parsed.success) {
					return adminError({
						code: "VALIDATION_ERROR",
						message: "Key name is invalid.",
						status: 400,
					});
				}

				const { rawKey, record } = await createApiKeyRecord({
					projectId: params.id,
					name: parsed.data.name || null,
				});

				return adminJson({ key: toPublicApiKey(record), rawKey }, 201);
			},
		},
	},
});
