export async function adminFetch<T>(
	url: string,
	options: RequestInit = {},
): Promise<T> {
	const headers = new Headers(options.headers);
	if (options.body) headers.set("Content-Type", "application/json");

	const response = await fetch(url, { ...options, headers });
	const body = await response.json().catch(() => null);

	if (!response.ok) {
		const message = body?.error?.message || body?.message || "Request failed.";
		throw new Error(message);
	}

	return body as T;
}

export function formatNumber(value: number): string {
	return new Intl.NumberFormat().format(value);
}

export function formatDate(value: string | null): string {
	if (!value) return "Never";
	return new Date(value).toLocaleString();
}

export function formatRelative(value: string | null): string {
	if (!value) return "Never";
	const date = new Date(value).getTime();
	const diff = Date.now() - date;
	if (diff < 60_000) return "Just now";
	if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
	if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
	return `${Math.floor(diff / 86_400_000)}d ago`;
}

export function successRate(summary: {
	requests: number;
	successes: number;
}): string {
	if (summary.requests === 0) return "—";
	return `${Math.round((summary.successes / summary.requests) * 100)}%`;
}
