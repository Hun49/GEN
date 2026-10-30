import {
	Activity,
	AlertTriangle,
	ArrowLeft,
	Check,
	ChevronRight,
	Coins,
	Copy,
	FolderKanban,
	KeyRound,
	Loader2,
	type LucideIcon,
	Plus,
	RefreshCw,
	Save,
	Timer,
	Trash2,
	X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
	adminFetch,
	formatDate,
	formatNumber,
	formatRelative,
	successRate,
} from "./admin-api";
import type { AdminKey, AdminProject, ProjectDetailData } from "./types";
import UsageTable from "./UsageTable";

export default function ProjectsPanel() {
	const [projects, setProjects] = useState<AdminProject[]>([]);
	const [selected, setSelected] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [creating, setCreating] = useState(false);

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const result = await adminFetch<{ projects: AdminProject[] }>(
				"/api/admin/projects",
			);
			setProjects(result.projects);
		} catch (err: any) {
			setError(err?.message || "Unable to load projects.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	if (selected) {
		return (
			<ProjectDetailPanel
				projectId={selected}
				onBack={() => {
					setSelected(null);
					void load();
				}}
			/>
		);
	}

	const handleCreate = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!name.trim()) return;
		setCreating(true);
		setError("");
		try {
			const result = await adminFetch<{ project: AdminProject }>(
				"/api/admin/projects",
				{
					method: "POST",
					body: JSON.stringify({
						name: name.trim(),
						description: description.trim() || undefined,
					}),
				},
			);
			setName("");
			setDescription("");
			setProjects((current) => [result.project, ...current]);
			setSelected(result.project.id);
		} catch (err: any) {
			setError(err?.message || "Unable to create project.");
		} finally {
			setCreating(false);
		}
	};

	return (
		<div className="space-y-5">
			<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
				<div>
					<h1 className="font-heading text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
						Projects
					</h1>
					<p className="mt-1 text-xs text-[var(--text-secondary)]">
						Each project has its own keys, schema, and daily limits.
					</p>
				</div>
				<button
					type="button"
					onClick={() => void load()}
					className="inline-flex items-center gap-1.5 self-start rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
				>
					<RefreshCw className="h-3 w-3" />
					Refresh
				</button>
			</div>

			<form onSubmit={handleCreate} className="gen-card p-4">
				<h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
					Create Project
				</h2>
				<div className="mt-3 flex flex-col gap-2 sm:flex-row">
					<input
						value={name}
						onChange={(event) => setName(event.target.value)}
						placeholder="Project name"
						maxLength={80}
						className="min-w-0 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
					/>
					<input
						value={description}
						onChange={(event) => setDescription(event.target.value)}
						placeholder="Description (optional)"
						maxLength={240}
						className="min-w-0 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
					/>
					<button
						type="submit"
						disabled={creating || !name.trim()}
						className="btn-primary inline-flex items-center justify-center gap-1.5 text-xs disabled:opacity-50"
					>
						{creating ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : (
							<Plus className="h-3.5 w-3.5" />
						)}
						Create
					</button>
				</div>
			</form>

			{error && (
				<div className="rounded-xl border border-[var(--color-danger)]/25 bg-[var(--color-danger-subtle)] px-3 py-2 text-xs text-[var(--color-danger)]">
					{error}
				</div>
			)}

			{loading ? (
				<div className="flex items-center gap-2 py-12 text-xs text-[var(--text-muted)]">
					<Loader2 className="h-4 w-4 animate-spin" />
					Loading projects...
				</div>
			) : projects.length === 0 ? (
				<div className="rounded-xl border border-dashed border-[var(--border-subtle)] py-12 text-center text-xs text-[var(--text-muted)]">
					No API projects yet. Create one above to issue a key.
				</div>
			) : (
				<div className="grid gap-3 sm:grid-cols-2">
					{projects.map((project) => (
						<button
							key={project.id}
							type="button"
							onClick={() => setSelected(project.id)}
							className="gen-card gen-card-hover p-4 text-left"
						>
							<div className="flex items-start justify-between gap-3">
								<div className="flex items-center gap-2.5">
									<div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]">
										<FolderKanban className="h-4 w-4 text-[var(--text-secondary)]" />
									</div>
									<div className="min-w-0">
										<p className="truncate text-xs font-semibold text-[var(--text-primary)]">
											{project.name}
										</p>
										<p className="mt-0.5 truncate font-mono text-[10px] text-[var(--text-muted)]">
											{project.id}
										</p>
									</div>
								</div>
								<ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
							</div>

							{project.description && (
								<p className="mt-3 line-clamp-2 text-[11px] text-[var(--text-secondary)]">
									{project.description}
								</p>
							)}

							<div className="mt-3 flex flex-wrap items-center gap-2">
								<span
									className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
										project.status === "active"
											? "border-[var(--color-success)]/25 bg-[var(--color-success-subtle)] text-[var(--color-success)]"
											: "border-[var(--color-warning)]/25 bg-[var(--color-warning-subtle)] text-[var(--color-warning)]"
									}`}
								>
									{project.status}
								</span>
								<span className="badge-neutral rounded-full px-2 py-0.5 text-[10px]">
									{project.keyCount ?? 0} key
									{(project.keyCount ?? 0) === 1 ? "" : "s"}
								</span>
								<span className="text-[10px] text-[var(--text-muted)]">
									{formatNumber(project.requestsPerMinute)}/min ·{" "}
									{formatNumber(project.requestsPerDay)}/day
								</span>
							</div>
						</button>
					))}
				</div>
			)}
		</div>
	);
}

function ProjectDetailPanel({
	projectId,
	onBack,
}: {
	projectId: string;
	onBack: () => void;
}) {
	const [data, setData] = useState<ProjectDetailData | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [range, setRange] = useState("24h");
	const [revealedKey, setRevealedKey] = useState<string | null>(null);
	const [keyError, setKeyError] = useState("");

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const result = await adminFetch<ProjectDetailData>(
				`/api/admin/projects/${projectId}?range=${range}`,
			);
			setData(result);
		} catch (err: any) {
			setError(err?.message || "Unable to load project.");
		} finally {
			setLoading(false);
		}
	}, [projectId, range]);

	useEffect(() => {
		void load();
	}, [load]);

	const updateKey = (key: AdminKey) => {
		setData((current) =>
			current
				? {
						...current,
						keys: current.keys.map((item) => (item.id === key.id ? key : item)),
					}
				: current,
		);
	};

	const createKey = async (keyName: string) => {
		setKeyError("");
		try {
			const result = await adminFetch<{ key: AdminKey; rawKey: string }>(
				`/api/admin/projects/${projectId}/keys`,
				{
					method: "POST",
					body: JSON.stringify({ name: keyName.trim() || undefined }),
				},
			);
			setData((current) =>
				current ? { ...current, keys: [result.key, ...current.keys] } : current,
			);
			setRevealedKey(result.rawKey);
		} catch (err: any) {
			setKeyError(err?.message || "Unable to create key.");
		}
	};

	const revokeKey = async (keyId: string) => {
		if (!confirm("Revoke this API key? This cannot be undone.")) return;
		try {
			const result = await adminFetch<{ key: AdminKey }>(
				`/api/admin/keys/${keyId}`,
				{ method: "DELETE" },
			);
			if (result.key) updateKey(result.key);
		} catch (err: any) {
			setKeyError(err?.message || "Unable to revoke key.");
		}
	};

	if (loading && !data) {
		return (
			<div className="flex items-center gap-2 py-12 text-xs text-[var(--text-muted)]">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading project...
			</div>
		);
	}

	if (!data) {
		return (
			<div className="gen-card p-6">
				<p className="text-xs text-[var(--color-danger)]">
					{error || "Project not found."}
				</p>
				<button
					type="button"
					onClick={onBack}
					className="btn-secondary mt-3 text-xs"
				>
					Back to projects
				</button>
			</div>
		);
	}

	const { project, usage } = data;

	return (
		<div className="space-y-5">
			<div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
				<div className="flex items-start gap-3">
					<button
						type="button"
						onClick={onBack}
						className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
						aria-label="Back to projects"
					>
						<ArrowLeft className="h-4 w-4" />
					</button>
					<div>
						<div className="flex flex-wrap items-center gap-2">
							<h1 className="font-heading text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
								{project.name}
							</h1>
							<span
								className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
									project.status === "active"
										? "border-[var(--color-success)]/25 bg-[var(--color-success-subtle)] text-[var(--color-success)]"
										: "border-[var(--color-warning)]/25 bg-[var(--color-warning-subtle)] text-[var(--color-warning)]"
								}`}
							>
								{project.status}
							</span>
						</div>
						<p className="mt-1 font-mono text-[10px] text-[var(--text-muted)]">
							{project.id}
						</p>
					</div>
				</div>
				<button
					type="button"
					onClick={() => void load()}
					className="inline-flex items-center gap-1.5 self-start rounded-lg border border-[var(--border-subtle)] px-2.5 py-1.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
				>
					<RefreshCw className="h-3 w-3" />
					Refresh
				</button>
			</div>

			{error && (
				<div className="rounded-xl border border-[var(--color-danger)]/25 bg-[var(--color-danger-subtle)] px-3 py-2 text-xs text-[var(--color-danger)]">
					{error}
				</div>
			)}

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				<MiniStat
					label="Requests"
					value={formatNumber(usage.usage.requests)}
					icon={Activity}
				/>
				<MiniStat
					label="Success"
					value={successRate(usage.usage)}
					icon={Check}
				/>
				<MiniStat
					label="Tokens"
					value={formatNumber(usage.usage.tokens)}
					icon={Coins}
				/>
				<MiniStat
					label="Avg latency"
					value={`${usage.usage.averageLatencyMs} ms`}
					icon={Timer}
				/>
			</div>

			<ProjectSettingsForm
				key={project.id}
				project={project}
				onSaved={(updated) =>
					setData((current) =>
						current ? { ...current, project: updated } : current,
					)
				}
			/>

			<KeysCard
				keys={data.keys}
				error={keyError}
				onCreate={createKey}
				onRevoke={revokeKey}
			/>

			<div className="gen-card overflow-hidden">
				<div className="flex flex-col justify-between gap-2 border-b border-[var(--border-subtle)] px-4 py-3 sm:flex-row sm:items-center">
					<div>
						<h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
							Recent Requests
						</h2>
						<p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
							{usage.usage.replays} replay
							{usage.usage.replays === 1 ? "" : "s"} · {usage.usage.failures}{" "}
							failure
							{usage.usage.failures === 1 ? "" : "s"}
						</p>
					</div>
					<select
						value={range}
						onChange={(event) => setRange(event.target.value)}
						className="self-start rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11px] text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
					>
						<option value="24h">Last 24 hours</option>
						<option value="30d">Last 30 days</option>
						<option value="all">All time</option>
					</select>
				</div>
				<div className="p-3">
					<UsageTable rows={usage.recent} />
				</div>
			</div>

			{revealedKey && (
				<RevealKeyModal
					rawKey={revealedKey}
					onClose={() => setRevealedKey(null)}
				/>
			)}
		</div>
	);
}

function ProjectSettingsForm({
	project,
	onSaved,
}: {
	project: AdminProject;
	onSaved: (project: AdminProject) => void;
}) {
	const [form, setForm] = useState({
		name: project.name,
		description: project.description || "",
		status: project.status,
		requestsPerMinute: String(project.requestsPerMinute),
		requestsPerDay: String(project.requestsPerDay),
		tokensPerDay: String(project.tokensPerDay),
		defaultResponseSchema: project.defaultResponseSchema || "",
	});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [saved, setSaved] = useState(false);

	const setField = (field: keyof typeof form, value: string) => {
		setForm((current) => ({ ...current, [field]: value }));
		setSaved(false);
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setSaving(true);
		setError("");
		setSaved(false);
		try {
			const result = await adminFetch<{ project: AdminProject }>(
				`/api/admin/projects/${project.id}`,
				{
					method: "PATCH",
					body: JSON.stringify({
						name: form.name.trim(),
						description: form.description.trim() || null,
						status: form.status,
						requestsPerMinute: Number(form.requestsPerMinute),
						requestsPerDay: Number(form.requestsPerDay),
						tokensPerDay: Number(form.tokensPerDay),
						defaultResponseSchema: form.defaultResponseSchema.trim() || null,
					}),
				},
			);
			onSaved(result.project);
			setSaved(true);
		} catch (err: any) {
			setError(err?.message || "Unable to save project.");
		} finally {
			setSaving(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="gen-card p-4 sm:p-5">
			<div className="flex items-center justify-between gap-3">
				<h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
					Project Settings
				</h2>
				{saved && (
					<span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--color-success)]">
						<Check className="h-3 w-3" />
						Saved
					</span>
				)}
			</div>

			<div className="mt-3 grid gap-3 sm:grid-cols-2">
				<label className="block">
					<span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
						Name
					</span>
					<input
						value={form.name}
						onChange={(event) => setField("name", event.target.value)}
						maxLength={80}
						className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
					/>
				</label>
				<label className="block">
					<span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
						Status
					</span>
					<select
						value={form.status}
						onChange={(event) => setField("status", event.target.value)}
						className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
					>
						<option value="active">Active</option>
						<option value="disabled">Disabled</option>
					</select>
				</label>
				<label className="block sm:col-span-2">
					<span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
						Description
					</span>
					<input
						value={form.description}
						onChange={(event) => setField("description", event.target.value)}
						maxLength={240}
						className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
					/>
				</label>
				<label className="block">
					<span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
						Requests / minute
					</span>
					<input
						type="number"
						min={1}
						max={1000}
						value={form.requestsPerMinute}
						onChange={(event) =>
							setField("requestsPerMinute", event.target.value)
						}
						className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
					/>
				</label>
				<label className="block">
					<span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
						Requests / day
					</span>
					<input
						type="number"
						min={1}
						max={100000}
						value={form.requestsPerDay}
						onChange={(event) => setField("requestsPerDay", event.target.value)}
						className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
					/>
				</label>
				<label className="block sm:col-span-2">
					<span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
						Tokens / day
					</span>
					<input
						type="number"
						min={1}
						max={100000000}
						value={form.tokensPerDay}
						onChange={(event) => setField("tokensPerDay", event.target.value)}
						className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
					/>
				</label>
				<label className="block sm:col-span-2">
					<span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
						Default response JSON Schema
					</span>
					<textarea
						value={form.defaultResponseSchema}
						onChange={(event) =>
							setField("defaultResponseSchema", event.target.value)
						}
						rows={9}
						spellCheck={false}
						placeholder="Leave blank to use the built-in exam schema."
						className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 font-mono text-[10px] leading-relaxed text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
					/>
					<span className="mt-1 block text-[10px] text-[var(--text-muted)]">
						Draft 2020-12, root object, max 16 KB. Requests can override this
						schema.
					</span>
				</label>
			</div>

			{error && (
				<div className="mt-3 rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-danger-subtle)] px-3 py-2 text-[11px] text-[var(--color-danger)]">
					{error}
				</div>
			)}

			<button
				type="submit"
				disabled={saving}
				className="btn-primary mt-3 inline-flex items-center gap-1.5 text-xs disabled:opacity-50"
			>
				{saving ? (
					<Loader2 className="h-3.5 w-3.5 animate-spin" />
				) : (
					<Save className="h-3.5 w-3.5" />
				)}
				Save settings
			</button>
		</form>
	);
}

function KeysCard({
	keys,
	error,
	onCreate,
	onRevoke,
}: {
	keys: AdminKey[];
	error: string;
	onCreate: (name: string) => Promise<void>;
	onRevoke: (keyId: string) => void;
}) {
	const [name, setName] = useState("");
	const [creating, setCreating] = useState(false);

	const handleCreate = async () => {
		setCreating(true);
		try {
			await onCreate(name);
			setName("");
		} finally {
			setCreating(false);
		}
	};

	return (
		<div className="gen-card overflow-hidden">
			<div className="border-b border-[var(--border-subtle)] px-4 py-3">
				<h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
					API Keys
				</h2>
				<p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
					Keys are only shown once when created.
				</p>
			</div>

			<div className="border-b border-[var(--border-subtle)] p-3">
				<div className="flex flex-col gap-2 sm:flex-row">
					<input
						value={name}
						onChange={(event) => setName(event.target.value)}
						placeholder="Key label (optional)"
						maxLength={80}
						className="min-w-0 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-main)] px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
					/>
					<button
						type="button"
						onClick={() => void handleCreate()}
						disabled={creating}
						className="btn-primary inline-flex items-center justify-center gap-1.5 text-xs disabled:opacity-50"
					>
						{creating ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : (
							<KeyRound className="h-3.5 w-3.5" />
						)}
						Create key
					</button>
				</div>
				{error && (
					<p className="mt-2 rounded-lg border border-[var(--color-danger)]/25 bg-[var(--color-danger-subtle)] px-3 py-2 text-[11px] text-[var(--color-danger)]">
						{error}
					</p>
				)}
			</div>

			{keys.length === 0 ? (
				<div className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">
					No keys yet.
				</div>
			) : (
				<div className="divide-y divide-[var(--border-subtle)]">
					{keys.map((key) => (
						<div
							key={key.id}
							className="flex flex-col justify-between gap-2 px-4 py-3 sm:flex-row sm:items-center"
						>
							<div className="min-w-0">
								<div className="flex flex-wrap items-center gap-2">
									<span className="text-xs font-semibold text-[var(--text-primary)]">
										{key.name || "Unnamed key"}
									</span>
									{key.revokedAt ? (
										<span className="badge-danger rounded-full px-2 py-0.5 text-[10px]">
											Revoked
										</span>
									) : (
										<span className="badge-success rounded-full px-2 py-0.5 text-[10px]">
											Active
										</span>
									)}
								</div>
								<p className="mt-1 font-mono text-[10px] text-[var(--text-muted)]">
									{key.keyPrefix}…{key.lastFour}
								</p>
								<p className="mt-1 text-[10px] text-[var(--text-muted)]">
									Created {formatDate(key.createdAt)} · Last used{" "}
									{formatRelative(key.lastUsedAt)}
								</p>
							</div>

							{!key.revokedAt && (
								<button
									type="button"
									onClick={() => onRevoke(key.id)}
									className="inline-flex items-center gap-1.5 self-start rounded-lg border border-[var(--color-danger)]/25 px-2.5 py-1.5 text-[11px] font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-subtle)]"
								>
									<Trash2 className="h-3 w-3" />
									Revoke
								</button>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

function RevealKeyModal({
	rawKey,
	onClose,
}: {
	rawKey: string;
	onClose: () => void;
}) {
	const [copied, setCopied] = useState(false);

	const copy = async () => {
		await navigator.clipboard.writeText(rawKey);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
			<div className="gen-card w-full max-w-lg p-5">
				<div className="flex items-start justify-between gap-3">
					<div className="flex items-start gap-2.5">
						<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]" />
						<div>
							<h2 className="text-sm font-bold text-[var(--text-primary)]">
								Copy this API key now
							</h2>
							<p className="mt-1 text-[11px] text-[var(--text-secondary)]">
								This is the only time the full key will be shown.
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-primary)]"
						aria-label="Close"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<pre className="mt-4 overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-main)] p-3 font-mono text-[11px] text-[var(--text-primary)]">
					{rawKey}
				</pre>

				<div className="mt-4 flex items-center justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						className="btn-secondary text-xs"
					>
						Done
					</button>
					<button
						type="button"
						onClick={() => void copy()}
						className="btn-primary inline-flex items-center gap-1.5 text-xs"
					>
						{copied ? (
							<Check className="h-3.5 w-3.5" />
						) : (
							<Copy className="h-3.5 w-3.5" />
						)}
						{copied ? "Copied" : "Copy key"}
					</button>
				</div>
			</div>
		</div>
	);
}

function MiniStat({
	label,
	value,
	icon: Icon,
}: {
	label: string;
	value: string;
	icon: LucideIcon;
}) {
	return (
		<div className="gen-card p-3">
			<div className="flex items-center justify-between gap-2">
				<span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
					{label}
				</span>
				<Icon className="h-3.5 w-3.5 text-[var(--text-muted)]" />
			</div>
			<p className="mt-1.5 font-heading text-lg font-bold text-[var(--text-primary)]">
				{value}
			</p>
		</div>
	);
}
