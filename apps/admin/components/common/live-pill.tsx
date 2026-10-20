import type { LiveState } from "@/contexts/notifications/lib/reconnecting-event-stream";

/** What the pill says while connected — the page's own words for what updates live. */
export interface LivePillProps {
	readonly state: LiveState;
	readonly openTitle: string;
}

/**
 * Connection indicator for a live (SSE) list — a pulsing dot and a word, never
 * the colour alone. `open`: updates flow on their own; `connecting`: the
 * first connect or an automatic reconnect; `closed`: it will not recover.
 */
export function LivePill({ state, openTitle }: LivePillProps): React.JSX.Element {
	const meta: Readonly<Record<LiveState, { readonly label: string; readonly dot: string; readonly text: string; readonly title: string }>> = {
		open: { label: "Live", dot: "bg-success", text: "text-success", title: openTitle },
		connecting: {
			label: "Connecting…",
			dot: "bg-warning",
			text: "text-warning",
			title: "Connecting to the live stream — updates resume automatically once connected.",
		},
		closed: {
			label: "Offline",
			dot: "bg-muted-foreground",
			text: "text-muted-foreground",
			title: "Live stream unavailable — use Refresh to pull the latest rows.",
		},
	};
	const current = meta[state];
	return (
		<span
			role="status"
			title={current.title}
			className={`inline-flex items-center gap-1.5 rounded-full border border-input bg-card px-2.5 py-1 text-xs font-medium ${current.text}`}>
			<span className={`size-1.5 animate-pulse rounded-full ${current.dot}`} />
			{current.label}
		</span>
	);
}
