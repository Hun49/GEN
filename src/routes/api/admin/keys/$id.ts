import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { apiKeys, apiProjects } from "#/db/schema";
import { adminError, adminJson, requireAdmin } from "#/lib/admin-api";
import { revokeApiKey, toPublicApiKey } from "#/lib/api-keys";

export const Route = createFileRoute("/api/admin/keys/$id")({
	server: {
		handlers: {
			GET: async ({ request, params }) => {
				const auth = await requireAdmin(request);
				if (!auth.ok) return auth.response;

				const row = await db
					.select({ key: apiKeys, project: apiProjects })
					.from(apiKeys)
					.innerJoin(apiProjects, eq(apiKeys.projectId, apiProjects.id))
					.where(eq(apiKeys.id, params.id))
					.get();

				if (!row) {
					return adminError({
						code: "NOT_FOUND",
						message: "API key not found.",
						status: 404,
					});
				}

				return adminJson({
					key: toPublicApiKey(row.key),
					project: row.project,
				});
			},

			DELETE: async ({ request, params }) => {
				const auth = await requireAdmin(request, { mutation: true });
				if (!auth.ok) return auth.response;

				const existing = await db
					.select()
					.from(apiKeys)
					.where(eq(apiKeys.id, params.id))
					.get();

				if (!existing) {
					return adminError({
						code: "NOT_FOUND",
						message: "API key not found.",
						status: 404,
					});
				}

				if (!existing.revokedAt) {
					await revokeApiKey({ keyId: existing.id });
				}

				const key = await db
					.select()
					.from(apiKeys)
					.where(eq(apiKeys.id, params.id))
					.get();

				return adminJson({
					key: key ? toPublicApiKey(key) : null,
					revoked: true,
				});
			},
		},
	},
});
