import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { db } from "#/db";
import { apiProjects } from "#/db/schema";
import { adminError, adminJson, requireAdmin } from "#/lib/admin-api";
import { getProjectUsage, parseUsageRange } from "#/lib/api-usage";

export const Route = createFileRoute("/api/admin/projects/$id/usage")({
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

				const range = parseUsageRange(
					new URL(request.url).searchParams.get("range"),
				);
				const usage = await getProjectUsage(project.id, range);

				return adminJson({ range, ...usage });
			},
		},
	},
});
