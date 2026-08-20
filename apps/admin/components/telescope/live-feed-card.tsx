"use client";

// ============================================
// components/telescope/live-feed-card.tsx
// The "Live activity" card shared by the overview, jobs and schedules pages.
// Events and the navigate callback arrive via props (rule 9/10); the ONLY
// state this widget owns is presentation state — which frame types to show.
// The filter is dual-mode: pages may control it via `filter` +
// `onFilterChange`, or leave it uncontrolled and the card keeps its own
// internal selection. Renders a title, an optional "view all" link, filter
// chips with live per-type counts, and the feed itself.
// ============================================

import { cn } from "@workspace/ui/lib/utils";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import type { TelescopeStreamEvent } from "@workspace/shared";

import { LiveFeed } from "@/components/telescope/live-feed";
import type { LiveFeedEvent } from "@/lib/use-telescope-live";

export type FeedFilter = "all" | "request" | "exception" | "job" | "schedule";

const FILTER_LABELS: Readonly<Record<FeedFilter, string>> = {
	all: "All",
	request: "Requests",
	exception: "Exceptions",
	job: "Jobs",
	schedule: "Schedules",
};

const FILTER_OPTIONS: readonly FeedFilter[] = ["all", "request", "exception", "job", "schedule"];

export interface LiveFeedCardProps {
	readonly title?: string;
	/** Buffered stream frames (oldest-first), straight from useTelescopeLive. */
	readonly events: readonly LiveFeedEvent[];
	readonly onNavigate: (event: TelescopeStreamEvent) => void;
	/** True while the SSE socket is deliberately paused (empty-state copy). */
	readonly paused?: boolean;
	/** Optional "view all" link shown in the card header. */
	readonly linkHref?: string;
	readonly linkLabel?: string;
	/** Controlled filter — omit to let the card manage its own selection. */
	readonly filter?: FeedFilter;
	readonly onFilterChange?: (filter: FeedFilter) => void;
}

export function LiveFeedCard({
	title = "Live activity",
	events,
	onNavigate,
	paused = false,
	linkHref,
	linkLabel = "View all →",
	filter: controlledFilter,
	onFilterChange,
}: LiveFeedCardProps): React.JSX.Element {
	const [internalFilter, setInternalFilter] = useState<FeedFilter>("all");
	const activeFilter: FeedFilter = controlledFilter ?? internalFilter;

	const handleFilterChange = useCallback(
		(value: FeedFilter): void => {
			if (onFilterChange !== undefined) {
				onFilterChange(value);
			} else {
				setInternalFilter(value);
			}
		},
		[onFilterChange],
	);

	// Per-type counts feed the chips; computed in one pass over the buffer.
	const counts: Readonly<Record<FeedFilter, number>> = useMemo((): Readonly<Record<FeedFilter, number>> => {
		const result: Record<FeedFilter, number> = { all: events.length, request: 0, exception: 0, job: 0, schedule: 0 };
		for (const event of events) {
			result[event.type] += 1;
		}
		return result;
	}, [events]);

	const visibleEvents: readonly LiveFeedEvent[] = useMemo((): readonly LiveFeedEvent[] => {
		if (activeFilter === "all") {
			return events;
		}
		return events.filter((event: LiveFeedEvent): boolean => event.type === activeFilter);
	}, [events, activeFilter]);

	const hasAnyActivity: boolean = events.length > 0;
	const hasMatchingActivity: boolean = visibleEvents.length > 0;

	return (
		<div className="rounded-lg border bg-card p-4 text-card-foreground shadow-xs">
			<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
				<h2 className="text-sm font-semibold text-foreground">{title}</h2>
				{linkHref !== undefined ? (
					<Link href={linkHref} className="text-xs font-medium text-primary hover:underline">
						{linkLabel}
					</Link>
				) : null}
			</div>

			<div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter live activity">
				{FILTER_OPTIONS.map((option) => (
					<FilterChip key={option} option={option} active={activeFilter === option} count={counts[option]} onSelect={handleFilterChange} />
				))}
			</div>

			{!hasAnyActivity ? (
				<div className="flex min-h-32 items-center justify-center rounded-md border border-dashed p-4 text-center">
					<p className="text-xs text-muted-foreground">
						{paused ? "Stream paused — resume to see live activity." : "Waiting for traffic… captured events show up here instantly."}
					</p>
				</div>
			) : !hasMatchingActivity ? (
				<div className="flex min-h-32 items-center justify-center rounded-md border border-dashed p-4 text-center">
					<p className="text-xs text-muted-foreground">Nothing matches this filter in the buffer yet.</p>
				</div>
			) : (
				<LiveFeed events={visibleEvents} onNavigate={onNavigate} />
			)}
		</div>
	);
}

/** Child component so onClick can live in a useCallback (eslint react/jsx-no-bind). */
function FilterChip({
	option,
	active,
	count,
	onSelect,
}: {
	readonly option: FeedFilter;
	readonly active: boolean;
	readonly count: number;
	readonly onSelect: (value: FeedFilter) => void;
}): React.JSX.Element {
	const handleClick = useCallback((): void => {
		onSelect(option);
	}, [onSelect, option]);

	return (
		<button
			type="button"
			onClick={handleClick}
			aria-pressed={active}
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
				active ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
			)}>
			{FILTER_LABELS[option]}
			<span className="font-mono text-[10px] tabular-nums opacity-70">{String(count)}</span>
		</button>
	);
}
