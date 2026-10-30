import { formatDate, formatNumber } from "./admin-api";
import type { UsageRow } from "./types";

export default function UsageTable({ rows }: { rows: UsageRow[] }) {
	if (rows.length === 0) {
		return (
			<div className="rounded-xl border border-dashed border-[var(--border-subtle)] py-10 text-center text-xs text-[var(--text-muted)]">
				No requests recorded for this range.
			</div>
		);
	}

	return (
		<div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
			<table className="w-full min-w-[760px] text-left text-xs">
				<thead className="bg-[var(--bg-surface-elevated)] text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
					<tr>
						<th className="px-3 py-2.5 font-semibold">Time</th>
						<th className="px-3 py-2.5 font-semibold">Request ID</th>
						<th className="px-3 py-2.5 font-semibold">Status</th>
						<th className="px-3 py-2.5 font-semibold">Outcome</th>
						<th className="px-3 py-2.5 font-semibold">Model</th>
						<th className="px-3 py-2.5 text-right font-semibold">Tokens</th>
						<th className="px-3 py-2.5 text-right font-semibold">Latency</th>
						<th className="px-3 py-2.5 font-semibold">Key</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => (
						<tr
							key={row.id}
							className="border-t border-[var(--border-subtle)] text-[var(--text-secondary)]"
						>
							<td className="whitespace-nowrap px-3 py-2.5">
								{formatDate(row.createdAt)}
							</td>
							<td className="max-w-[180px] truncate px-3 py-2.5 font-mono text-[10px] text-[var(--text-muted)]">
								{row.requestId}
							</td>
							<td className="px-3 py-2.5">
								<span
									className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
										row.statusCode >= 200 && row.statusCode < 300
											? "border-[var(--color-success)]/30 bg-[var(--color-success-subtle)] text-[var(--color-success)]"
											: "border-[var(--color-danger)]/30 bg-[var(--color-danger-subtle)] text-[var(--color-danger)]"
									}`}
								>
									{row.statusCode}
								</span>
							</td>
							<td className="px-3 py-2.5">
								<span className="font-mono text-[10px]">{row.outcome}</span>
								{row.errorCode && (
									<span className="ml-1 text-[10px] text-[var(--color-danger)]">
										{row.errorCode}
									</span>
								)}
							</td>
							<td className="px-3 py-2.5 font-mono text-[10px]">
								{row.model || "—"}
							</td>
							<td className="px-3 py-2.5 text-right font-mono text-[10px]">
								{formatNumber(row.totalTokens)}
							</td>
							<td className="px-3 py-2.5 text-right font-mono text-[10px]">
								{row.latencyMs === null ? "—" : `${row.latencyMs} ms`}
							</td>
							<td className="px-3 py-2.5 font-mono text-[10px] text-[var(--text-muted)]">
								{row.keyPrefix ? `${row.keyPrefix}…${row.lastFour}` : "—"}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
