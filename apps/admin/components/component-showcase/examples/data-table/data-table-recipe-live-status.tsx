"use client";

import * as React from "react";

import { Badge } from "@workspace/ui/components/badge";
import { DataTable, type DataTableColumns, type DataTableHeading } from "@workspace/ui/components/data-table";
import { Label } from "@workspace/ui/components/label";
import { Switch } from "@workspace/ui/components/switch";
import { cn } from "@workspace/ui/lib/core/utils";

type Health = "up" | "degraded" | "down";

/** One service's latest probe. */
interface ServiceProbe {
	readonly id: string;
	readonly name: string;
	readonly region: string;
	readonly latencyMs: number;
	readonly health: Health;
	/** How many probes this service has had; it climbs with every tick. */
	readonly checks: number;
}

export const INITIAL_PROBES: readonly ServiceProbe[] = [
	{ id: "api", name: "Public API", region: "ap-southeast-1", latencyMs: 84, health: "up", checks: 0 },
	{ id: "auth", name: "Auth", region: "ap-southeast-1", latencyMs: 61, health: "up", checks: 0 },
	{ id: "payments", name: "Payments", region: "ap-southeast-1", latencyMs: 212, health: "degraded", checks: 0 },
	{ id: "search", name: "Search", region: "eu-west-1", latencyMs: 140, health: "up", checks: 0 },
	{ id: "webhooks", name: "Webhooks", region: "us-east-1", latencyMs: 98, health: "up", checks: 0 },
];

/** Above this latency a service is degraded; above the second, down. */
const DEGRADED_ABOVE_MS = 200;
const DOWN_ABOVE_MS = 450;
/** Each tick moves latency by a step in this range, either way, so the sample wanders without running off. */
const LATENCY_SWING_MS = 60;
const LATENCY_FLOOR_MS = 30;
const LATENCY_CEILING_MS = 520;
/** How often the sample probes. */
export const PROBE_INTERVAL_MS = 2000;
/** A deterministic wobble: a prime stride over the swing, so the numbers look live but tests can predict them. */
const WOBBLE_STRIDE = 37;
const WOBBLE_HALF = LATENCY_SWING_MS / 2;

/** The health a latency means. */
export function healthFor(latencyMs: number): Health {
	if (latencyMs > DOWN_ABOVE_MS) {
		return "down";
	}
	return latencyMs > DEGRADED_ABOVE_MS ? "degraded" : "up";
}

/** The next probe for every service: a new latency, the health it means, and one more check. A pure step, so it is testable. */
export function nextProbes(probes: readonly ServiceProbe[], tick: number): ServiceProbe[] {
	return probes.map((probe, index): ServiceProbe => {
		const wobble = ((tick * WOBBLE_STRIDE + index * WOBBLE_STRIDE * WOBBLE_STRIDE) % LATENCY_SWING_MS) - WOBBLE_HALF;
		const latencyMs = Math.min(LATENCY_CEILING_MS, Math.max(LATENCY_FLOOR_MS, probe.latencyMs + wobble));
		return { ...probe, latencyMs, health: healthFor(latencyMs), checks: probe.checks + 1 };
	});
}

const HEALTH_STYLE: Readonly<Record<Health, { readonly label: string; readonly variant: "success-light" | "warning-light" | "destructive-light"; readonly dot: string }>> = {
	up: { label: "Operational", variant: "success-light", dot: "bg-success" },
	degraded: { label: "Degraded", variant: "warning-light", dot: "bg-warning" },
	down: { label: "Down", variant: "destructive-light", dot: "bg-destructive" },
};

function getProbeId(probe: ServiceProbe): string {
	return probe.id;
}

const COLUMNS: DataTableColumns<ServiceProbe> = [
	{ accessorKey: "name", header: "Service", size: 180 },
	{ accessorKey: "region", header: "Region", size: 150, meta: { cellClassName: "font-mono text-xs" } },
	{
		accessorKey: "health",
		header: "Status",
		size: 150,
		cell: ({ row }): React.JSX.Element => {
			const style = HEALTH_STYLE[row.original.health];
			return (
				<Badge variant={style.variant}>
					<span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden="true" />
					{style.label}
				</Badge>
			);
		},
	},
	{
		accessorKey: "latencyMs",
		header: "Latency",
		size: 110,
		cell: ({ row }): string => `${String(row.original.latencyMs)} ms`,
		meta: { cellClassName: "text-end tabular-nums", headerClassName: "text-end [&>div]:justify-end" },
	},
	{
		accessorKey: "checks",
		header: "Checks",
		size: 90,
		meta: { cellClassName: "text-end tabular-nums text-muted-foreground", headerClassName: "text-end [&>div]:justify-end" },
	},
];

/**
 * Recipe: live status. A timer replaces the rows every two seconds with new immutable objects; the table's memoised
 * rows still redraw, because each changed row is a new object. Pausing stops the timer, and sorting by latency keeps
 * re-sorting as the numbers move.
 */
export function DataTableRecipeLiveStatus(): React.JSX.Element {
	const [probes, setProbes] = React.useState<readonly ServiceProbe[]>(INITIAL_PROBES);
	const [isLive, setIsLive] = React.useState(true);
	const tickRef = React.useRef(0);
	const liveSwitchId = React.useId();

	React.useEffect((): (() => void) | undefined => {
		if (!isLive) {
			return undefined;
		}
		const timer = window.setInterval((): void => {
			tickRef.current += 1;
			const tick = tickRef.current;
			setProbes((current) => nextProbes(current, tick));
		}, PROBE_INTERVAL_MS);
		return (): void => {
			window.clearInterval(timer);
		};
	}, [isLive]);

	const heading = React.useMemo(
		(): DataTableHeading => ({
			title: "Service status",
			description: "Probed every two seconds.",
			actions: (
				<div className="flex items-center gap-2">
					<Switch id={liveSwitchId} checked={isLive} onCheckedChange={setIsLive} />
					<Label htmlFor={liveSwitchId}>Live</Label>
				</div>
			),
		}),
		[isLive, liveSwitchId],
	);

	return <DataTable data={probes} columns={COLUMNS} getRowId={getProbeId} heading={heading} />;
}
