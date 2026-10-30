import { createFileRoute } from "@tanstack/react-router";
import { adminError, adminJson, requireAdmin } from "#/lib/admin-api";
import { getAdminOverview, parseUsageRange } from "#/lib/api-usage";

export const Route = createFileRoute("/api/admin/overview")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const auth = await requireAdmin(request);
				if (!auth.ok) return auth.response;

				const range = parseUsageRange(
					new URL(request.url).searchParams.get("range"),
				);
				try {
					const overview = await getAdminOverview(range);
					return adminJson({ range, ...overview });
				} catch (error: any) {
					console.error("[Admin API] Overview failed:", error?.message);
					return adminError({
						code: "INTERNAL_ERROR",
						message: "Unable to load overview.",
						status: 500,
					});
				}
			},
		},
	},
});
