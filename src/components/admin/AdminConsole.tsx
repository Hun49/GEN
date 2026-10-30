import { Link } from "@tanstack/react-router";
import {
	Activity,
	ArrowLeft,
	BookOpen,
	Eye,
	EyeOff,
	FolderKanban,
	KeyRound,
	LayoutDashboard,
	Loader2,
	Lock,
	LogOut,
	type LucideIcon,
	RefreshCw,
	ShieldCheck,
	Terminal,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { adminFetch, formatNumber, successRate } from "./admin-api";
import ProjectsPanel from "./ProjectsPanel";
import type { OverviewData } from "./types";
import UsageTable from "./UsageTable";

type Tab = "overview" | "projects" | "docs";

interface SessionInfo {
	authenticated: boolean;
	configured: boolean;
	expiresAt?: string;
}

export default function AdminConsole({ docs }: { docs: string }) {
	const [session, setSession] = useState<SessionInfo | null>(null);
	const [checking, setChecking] = useState(true);
	const [error, setError] = useState("");

	const loadSession = useCallback(async () => {
		setChecking(true);
		setError("");
		try {
			const result = await adminFetch<SessionInfo>("/api/admin/session");
			setSession(result);
		} catch (err: any) {
			setError(err?.message || "Unable to reach the admin API.");
		} finally {
			setChecking(false);
		}
	}, []);

	useEffect(() => {
		void loadSession();
	}, [loadSession]);

	const handleLogout = async () => {
		try {
			await adminFetch("/api/admin/session", { method: "DELETE" });
		} catch {}
		setSession((current) =>
			current ? { ...current, authenticated: false } : current,
		);
	};

	if (checking) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-[var(--bg-main)]">
				<div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
					<Loader2 className="h-4 w-4 animate-spin" />
					Loading API console...
				</div>
			</div>
		);
	}

	if (error && !session) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-[var(--bg-main)] p-4">
				<div className="gen-card w-full max-w-md p-6 text-center">
					<p className="text-sm font-semibold text-[var(--text-primary)]">
						Could not load the API console
					</p>
					<p className="mt-1 text-xs text-[var(--text-secondary)]">{error}</p>
					<button
						type="button"
						onClick={() => void loadSession()}
						className="btn-primary mt-4 inline-flex items-center gap-2 text-xs"
					>
						<RefreshCw className="h-3.5 w-3.5" />
						Retry
					</button>
				</div>
			</div>
		);
	}

	if (!session?.configured) {
		return <AdminSetup />;
	}

	if (!session.authenticated) {
		return <AdminLogin onSuccess={() => void loadSession()} />;
	}

	return (
		<AdminDashboard
			docs={docs}
			expiresAt={session.expiresAt}
			onLogout={() => void handleLogout()}
		/>
	);
}

function AdminSetup() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-[var(--bg-main)] p-4">
			<div className="gen-card w-full max-w-lg p-6">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]">
						<ShieldCheck className="h-5 w-5 text-[var(--text-primary)]" />
					</div>
					<div>
						<h1 className="font-heading text-lg font-bold text-[var(--text-primary)]">
							API Console Setup
						</h1>
						<p className="text-xs text-[var(--text-muted)]">
							Admin authentication is not configured.
						</p>
					</div>
				</div>

				<div className="mt-5 space-y-3 text-xs leading-relaxed text-[var(--text-secondary)]">
					<p>
						Generate a password hash and add it as{" "}
						<code className="rounded bg-[var(--bg-surface-elevated)] px-1 py-0.5 font-mono text-[10px]">
							ADMIN_PASSWORD_HASH
						</code>{" "}
						to your environment.
					</p>
					<pre className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-main)] p-3 font-mono text-[10px] text-[var(--text-primary)]">
						{`pnpm admin:hash "your-strong-password"`}
					</pre>
					<p>
						Restart the dev server after updating{" "}
						<code className="rounded bg-[var(--bg-surface-elevated)] px-1 py-0.5 font-mono text-[10px]">
							.dev.vars
						</code>
						.
					</p>
				</div>

				<Link
					to="/"
					className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] no-underline hover:text-[var(--text-primary)]"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
					Back to GEN
				</Link>
			</div>
		</div>
	);
}

function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!password) return;
		setBusy(true);
		setError("");
		try {
			await adminFetch("/api/admin/session", {
				method: "POST",
				body: JSON.stringify({ password }),
			});
			setPassword("");
			onSuccess();
		} catch (err: any) {
			setError(err?.message || "Login failed.");
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex min-h-screen items-center justify-center bg-[var(--bg-main)] p-4">
			<div className="gen-card w-full max-w-sm p-6">
				<div className="flex items-center gap-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]">
						<Lock className="h-5 w-5 text-[var(--text-primary)]" />
					</div>
					<div>
						<h1 className="font-heading text-lg font-bold text-[var(--text-primary)]">
							API Console
						</h1>
						<p className="text-xs text-[var(--text-muted)]">
							Admin access only
						</p>
					</div>
				</div>

				<form onSubmit={handleSubmit} className="mt-5 space-y-3">
					<label
						htmlFor="admin-password"
						className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
					>
						Password
					</label>
					<div className="relative">
						<input
							id="admin-password"
							type={showPassword ? "text" : "password"}
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							autoComplete="current-password"
							className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2.5 pr-10 text-xs text-[var(--text-primary)] outline-none transition focus:border-[var(--border-strong)]"
							placeholder="Enter admin password"
						/>
						<button
							type="button"
							onClick={() => setShowPassword((value) => !value)}
							className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-primary)]"
							aria-label={showPassword ? "Hide password" : "Show password"}
						>
							{showPassword ? (
								<EyeOff className="h-3.5 w-3.5" />
							) : (
								<Eye className="h-3.5 w-3.5" />
							)}
						</button>
					</div>

					{error && (
						<p className="rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-danger-subtle)] px-3 py-2 text-[11px] text-[var(--color-danger)]">
							{error}
						</p>
					)}

					<button
						type="submit"
						disabled={busy || !password}
						className="btn-primary flex w-full items-center justify-center gap-2 text-xs disabled:opacity-50"
					>
						{busy ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : (
							<KeyRound className="h-3.5 w-3.5" />
						)}
						{busy ? "Signing in..." : "Sign in"}
					</button>
				</form>

				<div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-3">
					<p className="text-[10px] leading-relaxed text-[var(--text-muted)]">
						if your not admin please leave and use gen accordingly
					</p>
					<Link
						to="/"
						className="shrink-0 text-[10px] font-medium text-[var(--text-secondary)] no-underline hover:text-[var(--text-primary)]"
					>
						Back
					</Link>
				</div>
			</div>
		</div>
	);
}

function AdminDashboard({
	docs,
	expiresAt,
	onLogout,
}: {
	docs: string;
	expiresAt?: string;
	onLogout: () => void;
}) {
	const [tab, setTab] = useState<Tab>("overview");

	const tabs: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
		{ id: "overview", label: "Overview", icon: LayoutDashboard },
		{ id: "projects", label: "Projects", icon: FolderKanban },
		{ id: "docs", label: "Docs", icon: BookOpen },
	];

	return (
		<div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)]">
			<header className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
				<div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
					<div className="flex items-center gap-3">
						<Link
							to="/"
							className="flex items-center gap-2 no-underline"
							title="Back to GEN"
						>
							<span className="font-heading text-sm font-bold tracking-tight text-[var(--text-primary)]">
								GEN
							</span>
							<span className="hidden rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-[var(--text-muted)] sm:inline">
								API
							</span>
						</Link>
					</div>

					<nav className="flex items-center gap-1">
						{tabs.map(({ id, label, icon: Icon }) => (
							<button
								key={id}
								type="button"
								onClick={() => setTab(id)}
								className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
									tab === id
										? "bg-[var(--bg-surface-elevated)] text-[var(--text-primary)]"
										: "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-primary)]"
								}`}
							>
								<Icon className="h-3.5 w-3.5" />
								<span className="hidden sm:inline">{label}</span>
							</button>
						))}
					</nav>

					<div className="flex items-center gap-2">
						<span className="hidden text-[10px] text-[var(--text-muted)] lg:inline">
							{expiresAt
								? `Session until ${new Date(expiresAt).toLocaleTimeString()}`
								: ""}
						</span>
						<button
							type="button"
							onClick={onLogout}
							className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
						>
							<LogOut className="h-3.5 w-3.5" />
							<span className="hidden sm:inline">Logout</span>
						</button>
					</div>
				</div>
			</header>

			<main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
				{tab === "overview" && <OverviewPanel />}
				{tab === "projects" && <ProjectsPanel />}
				{tab === "docs" && <DocsPanel docs={docs} />}
			</main>
		</div>
	);
}

function OverviewPanel() {
	const [range, setRange] = useState("24h");
	const [data, setData] = useState<OverviewData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const result = await adminFetch<OverviewData>(
				`/api/admin/overview?range=${range}`,
			);
			setData(result);
		} catch (err: any) {
			setError(err?.message || "Unable to load overview.");
		} finally {
			setLoading(false);
		}
	}, [range]);

	useEffect(() => {
		void load();
	}, [load]);

	return (
		<div className="space-y-5">
			<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
				<div>
					<h1 className="font-heading text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
						API Overview
					</h1>
					<p className="mt-1 text-xs text-[var(--text-secondary)]">
						Monitor external API traffic, quotas, and recent requests.
					</p>
				</div>
				<RangeSelect value={range} onChange={setRange} />
			</div>

			{error && (
				<div className="rounded-xl border border-[var(--color-danger)]/25 bg-[var(--color-danger-subtle)] px-3 py-2 text-xs text-[var(--color-danger)]">
					{error}
				</div>
			)}

			{loading && !data ? (
				<div className="flex items-center gap-2 py-12 text-xs text-[var(--text-muted)]">
					<Loader2 className="h-4 w-4 animate-spin" />
					Loading overview...
				</div>
			) : data ? (
				<>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						<StatCard
							label="Projects"
							value={formatNumber(data.projects)}
							detail="All projects"
							icon={FolderKanban}
						/>
						<StatCard
							label="Active Keys"
							value={formatNumber(data.activeKeys)}
							detail="Not revoked"
							icon={KeyRound}
						/>
						<StatCard
							label="Requests"
							value={formatNumber(data.usage.requests)}
							detail={`${successRate(data.usage)} success`}
							icon={Activity}
						/>
						<StatCard
							label="Tokens"
							value={formatNumber(data.usage.tokens)}
							detail={`${data.usage.averageLatencyMs} ms avg`}
							icon={Terminal}
						/>
					</div>

					<div className="gen-card overflow-hidden">
						<div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] px-4 py-3">
							<div>
								<h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
									Recent Requests
								</h2>
								<p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
									{data.usage.replays} idempotent replay
									{data.usage.replays === 1 ? "" : "s"} in this range
								</p>
							</div>
							<button
								type="button"
								onClick={() => void load()}
								className="flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
							>
								<RefreshCw className="h-3 w-3" />
								Refresh
							</button>
						</div>
						<div className="p-3">
							<UsageTable rows={data.recent} />
						</div>
					</div>
				</>
			) : null}
		</div>
	);
}

function DocsPanel({ docs }: { docs: string }) {
	return (
		<div className="space-y-4">
			<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
				<div>
					<h1 className="font-heading text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
						API Documentation
					</h1>
					<p className="mt-1 text-xs text-[var(--text-secondary)]">
						Source: <span className="font-mono">docs/external-api.md</span>
					</p>
				</div>
				<Link
					to="/api"
					className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] no-underline hover:text-[var(--text-primary)]"
				>
					<ArrowLeft className="h-3 w-3" />
					Console
				</Link>
			</div>

			<div className="gen-card p-4 sm:p-6">
				<pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-[var(--text-secondary)]">
					{docs}
				</pre>
			</div>
		</div>
	);
}

function StatCard({
	label,
	value,
	detail,
	icon: Icon,
}: {
	label: string;
	value: string;
	detail: string;
	icon: LucideIcon;
}) {
	return (
		<div className="gen-card p-4">
			<div className="flex items-center justify-between gap-2">
				<span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
					{label}
				</span>
				<Icon className="h-4 w-4 text-[var(--text-muted)]" />
			</div>
			<p className="mt-2 font-heading text-2xl font-bold text-[var(--text-primary)]">
				{value}
			</p>
			<p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{detail}</p>
		</div>
	);
}

function RangeSelect({
	value,
	onChange,
}: {
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<select
			value={value}
			onChange={(event) => onChange(event.target.value)}
			className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
		>
			<option value="24h">Last 24 hours</option>
			<option value="30d">Last 30 days</option>
			<option value="all">All time</option>
		</select>
	);
}
