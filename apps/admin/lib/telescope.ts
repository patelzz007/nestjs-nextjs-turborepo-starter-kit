// ============================================
// lib/telescope.ts - Presentation helpers for the Telescope section
// ============================================
// Pure formatters + token-driven visual metadata. No data fetching here —
// pages own the queries (rule 9/10), these just make the dumb components
// consistent (rule 22: no hardcoded colors in components).

import type { TelescopeRange, TelescopeSpanKind } from "@workspace/shared";

// ── Status tone (request status codes) ─────────────────────────────────────

export interface StatusTone {
	readonly label: string;
	/** Pill classes: border + text, both light & dark. */
	readonly pillClass: string;
	/** Dot used next to a label. */
	readonly dotClass: string;
}

/** Maps a request status code to a tone. Null (aborted) → muted. */
export function statusTone(statusCode: number | null): StatusTone {
	if (statusCode === null) {
		return { label: "—", pillClass: "border-border text-muted-foreground", dotClass: "bg-muted-foreground" };
	}
	if (statusCode < 300) {
		return { label: String(statusCode), pillClass: "border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-400", dotClass: "bg-emerald-500" };
	}
	if (statusCode < 400) {
		return { label: String(statusCode), pillClass: "border-sky-300/60 bg-sky-500/10 text-sky-700 dark:border-sky-500/40 dark:text-sky-400", dotClass: "bg-sky-500" };
	}
	if (statusCode < 500) {
		return { label: String(statusCode), pillClass: "border-amber-300/60 bg-amber-500/10 text-amber-700 dark:border-amber-500/40 dark:text-amber-400", dotClass: "bg-amber-500" };
	}
	return { label: String(statusCode), pillClass: "border-red-300/60 bg-red-500/10 text-red-700 dark:border-red-500/40 dark:text-red-400", dotClass: "bg-red-500" };
}

// ── Duration / time formatting ─────────────────────────────────────────────

/** `842` → `842ms`, `1850` → `1.9s`. */
export function durationLabel(ms: number): string {
	if (ms < 1000) {
		return `${Math.round(ms)}ms`;
	}
	return `${(ms / 1000).toFixed(1)}s`;
}

/** Module-scope formatter — one `Intl.DateTimeFormat` for every cell render. */
const TIME_FORMATTER: Intl.DateTimeFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" });

export function formatTime(iso: string): string {
	return TIME_FORMATTER.format(new Date(iso));
}

// ── Span kind metadata (timeline colors) ───────────────────────────────────

export interface SpanKindMeta {
	readonly label: string;
	/** Bar fill classes (light + dark both readable). */
	readonly barClass: string;
}

const SPAN_KIND_META: Readonly<Record<TelescopeSpanKind, SpanKindMeta>> = {
	middleware: { label: "Middleware", barClass: "bg-slate-500" },
	guard: { label: "Guard", barClass: "bg-indigo-500" },
	interceptor: { label: "Interceptor", barClass: "bg-sky-500" },
	service: { label: "Service", barClass: "bg-blue-500" },
	prisma: { label: "Prisma", barClass: "bg-violet-500" },
	queue: { label: "Queue", barClass: "bg-amber-500" },
	serialization: { label: "Serialization", barClass: "bg-emerald-500" },
	other: { label: "Other", barClass: "bg-zinc-500" },
};

export function spanKindMeta(kind: TelescopeSpanKind): SpanKindMeta {
	return SPAN_KIND_META[kind];
}

// ── Overview range options ─────────────────────────────────────────────────

export const RANGE_OPTIONS: readonly { readonly value: TelescopeRange; readonly label: string }[] = [
	{ value: "15m", label: "15m" },
	{ value: "1h", label: "1h" },
	{ value: "6h", label: "6h" },
	{ value: "24h", label: "24h" },
];

export function rangeLabel(range: TelescopeRange): string {
	return range === "15m" ? "last 15 minutes" : range === "1h" ? "last hour" : range === "6h" ? "last 6 hours" : "last 24 hours";
}
