"use client";

// What a machine is (its spec: CPU, RAM, storage) next to what it is using right now (used and free).
// The spec comes from the agent's latest report; usage from its live sample, so a silent agent still
// shows what the machine is, with "—" for what it is doing.

import { storageTotals, type OpsServerLive, type OpsServerSummary, type StorageTotals } from "@workspace/shared";
import { Progress } from "@workspace/ui/components/progress";
import { Cpu, HardDrive, MemoryStick, Repeat } from "lucide-react";
import * as React from "react";

import { formatBytes, formatPercent, formatUptime, percentOf } from "../lib/ops-format";

/** One resource: its size, how much is used and free, and a bar. */
function SpecRow({
	icon,
	label,
	totalBytes,
	usedBytes,
	note,
}: {
	readonly icon: React.ReactNode;
	readonly label: string;
	readonly totalBytes: number | null;
	readonly usedBytes: number | null;
	readonly note?: string | undefined;
}): React.JSX.Element {
	const percent: number | null = totalBytes === null || usedBytes === null || totalBytes === 0 ? null : percentOf(usedBytes, totalBytes);
	return (
		<div className="space-y-1.5">
			<div className="flex items-baseline justify-between gap-3">
				<span className="flex items-center gap-2 text-sm font-medium">
					{icon}
					{label}
				</span>
				<span className="text-sm font-semibold tabular-nums">{totalBytes === null ? "—" : formatBytes(totalBytes)}</span>
			</div>
			<Progress value={percent ?? 0} aria-label={`${label}: ${formatPercent(percent)} used`} />
			<div className="flex justify-between gap-3 text-xs text-muted-foreground tabular-nums">
				<span>{usedBytes === null ? "Used —" : `${formatBytes(usedBytes)} used (${formatPercent(percent)})`}</span>
				<span>{totalBytes === null || usedBytes === null ? "" : `${formatBytes(Math.max(0, totalBytes - usedBytes))} free`}</span>
			</div>
			{note === undefined ? null : <p className="text-xs text-muted-foreground">{note}</p>}
		</div>
	);
}

/** The server page's spec panel: CPU, RAM, swap and each disk — size, used and free. */
export function MachineSpec({
	server,
	live,
}: {
	readonly server: Pick<OpsServerSummary, "cpuModel" | "cpuCores" | "memoryTotalBytes" | "uptimeSeconds" | "os" | "hostname">;
	readonly live: OpsServerLive | null;
}): React.JSX.Element {
	const storage: StorageTotals | null = live === null || live.disks.length === 0 ? null : storageTotals(live.disks);
	return (
		<div className="grid gap-5">
			<div className="flex items-start gap-3">
				<Cpu aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
				<div className="min-w-0">
					<p className="text-sm font-medium">{server.cpuModel ?? "CPU not reported yet"}</p>
					<p className="text-xs text-muted-foreground">
						{server.cpuCores === null ? "—" : `${String(server.cpuCores)} cores`}
						{live === null ? "" : ` · ${formatPercent(live.cpuPercent)} busy now`}
						{server.uptimeSeconds === null ? "" : ` · up ${formatUptime(server.uptimeSeconds)}`}
					</p>
					<p className="truncate text-xs text-muted-foreground">{[server.os, server.hostname].filter((part) => part !== null).join(" · ")}</p>
				</div>
			</div>
			<SpecRow
				icon={<MemoryStick aria-hidden className="size-4 text-muted-foreground" />}
				label="Memory (RAM)"
				totalBytes={live?.memoryTotalBytes ?? server.memoryTotalBytes}
				usedBytes={live?.memoryUsedBytes ?? null}
			/>
			{live === null || live.swapTotalBytes === 0 ? null : (
				<SpecRow icon={<Repeat aria-hidden className="size-4 text-muted-foreground" />} label="Swap" totalBytes={live.swapTotalBytes} usedBytes={live.swapUsedBytes} />
			)}
			<SpecRow
				icon={<HardDrive aria-hidden className="size-4 text-muted-foreground" />}
				label="Storage"
				totalBytes={storage?.totalBytes ?? null}
				usedBytes={storage?.usedBytes ?? null}
				note={live === null ? undefined : `${String(live.disks.length)} mounted ${live.disks.length === 1 ? "disk" : "disks"}`}
			/>
			{live === null || live.disks.length < 2
				? null
				: live.disks.map((disk) => (
						<SpecRow
							key={disk.mount}
							icon={<HardDrive aria-hidden className="size-3.5 text-muted-foreground/70" />}
							label={disk.mount}
							totalBytes={disk.totalBytes}
							usedBytes={disk.usedBytes}
						/>
					))}
		</div>
	);
}
