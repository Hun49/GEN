import { createFileRoute } from "@tanstack/react-router";
import AdminConsole from "#/components/admin/AdminConsole";
import docs from "../../docs/external-api.md?raw";

export const Route = createFileRoute("/api_")({
	component: ApiAdminPage,
});

function ApiAdminPage() {
	return <AdminConsole docs={docs} />;
}
