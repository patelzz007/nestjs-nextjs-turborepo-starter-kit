"use client";

// ============================================
// components/telescope/live-feed.tsx
// Improvement v2 — live activity feed. Renders the buffered SSE frames as an
// animated, scrollable list (framer-motion entrance). The stream schema is a
// strict discriminated union, so each row type is fully narrowed:
// - request rows show method/path/status/duration and navigate to the detail,
// - exception rows show name/message and navigate to the exceptions list,
// - job rows show jobName/jobStatus/duration (static — no navigation),
// - schedule rows show scheduleName/scheduleStatus/duration (static).
// Dumb: the events + a navigate callback arrive via props.
// ============================================

import { cn } from "@workspace/ui/lib/utils";
import { motion } from "framer-motion";
import { ArrowUpRight, BriefcaseBusiness, CalendarClock, TriangleAlert } from "lucide-react";
import { memo, useCallback } from "react";

import type { TelescopeStreamEvent } from "@workspace/shared";

import { durationLabel, jobStatusTone, scheduleStatusTone, statusTone, timeAgo } from "@/lib/telescope";

import type { LiveFeedEvent } from "@/lib/use-telescope-live";

export interface LiveFeedProps {
	readonly events: readonly LiveFeedEvent[];
	/** Called when a clickable feed row is clicked (request/exception only). */
	readonly onNavigate: (event: TelescopeStreamEvent) => void;
}

interface FeedRowProps {
	readonly event: LiveFeedEvent;
	readonly onNavigate: (event: TelescopeStreamEvent) => void;
}

/** One feed row — memoized so only genuinely new frames re-render. */
function FeedRow({ event, onNavigate }: FeedRowProps): React.JSX.Element {
	const handleClick = useCallback((): void => {
		onNavigate(event);
	}, [event, onNavigate]);

	if (event.type === "exception") {
		const tone = statusTone(event.statusCode);
		return (
			<motion.button
				type="button"
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.22, ease: "easeOut" }}
				onClick={handleClick}
				className="flex w-full items-center gap-2.5 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2 text-left transition-colors hover:border-destructive/40 hover:bg-destructive/10">
				<TriangleAlert className="size-3.5 shrink-0 text-destructive" />
				<span className="min-w-0 flex-1">
					<span className="block truncate font-mono text-xs font-medium text-destructive">{event.name}</span>
					<span className="block truncate text-[11px] text-muted-foreground">{event.message}</span>
				</span>
				<span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[10px]", tone.pillClass)}>{tone.label}</span>
			</motion.button>
		);
	}

	if (event.type === "job") {
		// Jobs that ran inside a captured request carry a correlation id — those
		// rows navigate to the request; background jobs stay static.
		const jobBody = (
			<>
				<BriefcaseBusiness className="size-3.5 shrink-0 text-muted-foreground" />
				<span className="min-w-0 flex-1">
					<span className="block truncate font-mono text-xs font-medium text-foreground">{event.jobName}</span>
					<span className="block text-[11px] text-muted-foreground tabular-nums">
						{durationLabel(event.durationMs ?? 0)} · {timeAgo(event.receivedAt)}
					</span>
				</span>
			</>
		);
		const statusPill = (
			<span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${jobStatusTone(event.jobStatus)}`}>
				<span className="size-1.5 rounded-full bg-current" />
				{event.jobStatus}
			</span>
		);
		if (event.correlationId !== null) {
			return (
				<motion.button
					type="button"
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.22, ease: "easeOut" }}
					onClick={handleClick}
					className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-accent/40">
					{jobBody}
					{/* Correlation badge: this row jumps to the request the job ran inside. */}
					<span
						title="Open the correlated request"
						className="inline-flex max-w-28 shrink-0 items-center gap-1 rounded-full border border-primary/25 bg-primary/5 px-1.5 py-0.5 font-mono text-[10px] text-primary">
						<ArrowUpRight className="size-3 shrink-0" />
						<span className="truncate">{event.correlationId}</span>
					</span>
					{statusPill}
				</motion.button>
			);
		}
		return (
			<motion.div
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.22, ease: "easeOut" }}
				className="flex w-full items-center gap-2.5 rounded-lg border bg-card px-3 py-2">
				{jobBody}
				{statusPill}
			</motion.div>
		);
	}

	if (event.type === "schedule") {
		return (
			<motion.div
				initial={{ opacity: 0, y: -10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.22, ease: "easeOut" }}
				className="flex w-full items-center gap-2.5 rounded-lg border bg-card px-3 py-2">
				<CalendarClock className="size-3.5 shrink-0 text-muted-foreground" />
				<span className="min-w-0 flex-1">
					<span className="block truncate font-mono text-xs font-medium text-foreground">{event.scheduleName}</span>
					<span className="block text-[11px] text-muted-foreground tabular-nums">
						{durationLabel(event.durationMs ?? 0)} · {timeAgo(event.receivedAt)}
					</span>
				</span>
				<span
					className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${scheduleStatusTone(event.scheduleStatus)}`}>
					<span className="size-1.5 rounded-full bg-current" />
					{event.scheduleStatus}
				</span>
			</motion.div>
		);
	}

	// Request row (the final variant).
	const tone = statusTone(event.statusCode);
	return (
		<motion.button
			type="button"
			initial={{ opacity: 0, y: -10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.22, ease: "easeOut" }}
			onClick={handleClick}
			className="flex w-full items-center gap-2.5 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-accent/40">
			<span className="w-11 shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-center font-mono text-[10px] font-semibold text-foreground">{event.method}</span>
			<span className="min-w-0 flex-1">
				<span className="block truncate font-mono text-xs text-foreground">{event.path}</span>
				<span className="block text-[11px] text-muted-foreground tabular-nums">
					{durationLabel(event.durationMs)} · {timeAgo(event.receivedAt)}
				</span>
			</span>
			{event.statusCode !== null ? (
				<span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono text-[10px]", tone.pillClass)}>
					<span className={cn("size-1.5 rounded-full", tone.dotClass)} />
					{tone.label}
				</span>
			) : null}
		</motion.button>
	);
}

const MemoizedFeedRow = memo(FeedRow);

/** Scrollable live feed of recent telescope events, newest on top. */
export function LiveFeed({ events, onNavigate }: LiveFeedProps): React.JSX.Element {
	// Oldest-first buffer from the hook; newest events must render on top.
	const reversed: readonly LiveFeedEvent[] = [...events].reverse();

	return (
		<div className="flex max-h-96 flex-col gap-1.5 overflow-y-auto pr-1" role="log" aria-live="polite" aria-label="Live telescope activity">
			{reversed.map((event) => (
				<MemoizedFeedRow key={event.seq} event={event} onNavigate={onNavigate} />
			))}
		</div>
	);
}
