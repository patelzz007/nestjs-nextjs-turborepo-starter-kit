// ============================================
// lib/telescope.ts - Presentation helpers for the Telescope section
// ============================================
// Pure formatters + token-driven visual metadata. No data fetching here —
// pages own the queries (rule 9/10), these just make the dumb components
// consistent (rule 22: no hardcoded colors in components).

import type { RequestLogEntry, TelescopePiiCategory, TelescopeRange, TelescopeSpanKind, TelescopeStreamEvent } from "@workspace/shared";
import { z } from "zod";

import { formatDateTime, timeAgo as timeAgoLabel } from "@/lib/dates";

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
		return {
			label: String(statusCode),
			pillClass: "border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-400",
			dotClass: "bg-emerald-500",
		};
	}
	if (statusCode < 400) {
		return { label: String(statusCode), pillClass: "border-sky-300/60 bg-sky-500/10 text-sky-700 dark:border-sky-500/40 dark:text-sky-400", dotClass: "bg-sky-500" };
	}
	if (statusCode < 500) {
		return {
			label: String(statusCode),
			pillClass: "border-amber-300/60 bg-amber-500/10 text-amber-700 dark:border-amber-500/40 dark:text-amber-400",
			dotClass: "bg-amber-500",
		};
	}
	return { label: String(statusCode), pillClass: "border-red-300/60 bg-red-500/10 text-red-700 dark:border-red-500/40 dark:text-red-400", dotClass: "bg-red-500" };
}

// ── Duration / time formatting ─────────────────────────────────────────────

/** `842` → `842ms`, `1850` → `1.9s`. */
export function durationLabel(ms: number): string {
	if (ms < 1000) {
		return `${String(Math.round(ms))}ms`;
	}
	return `${(ms / 1000).toFixed(1)}s`;
}

/** Epoch-ms timestamp → locale string via date-fns (see lib/dates.ts). */
export function formatTime(ms: number): string {
	return formatDateTime(ms);
}

// ── Relative time (improvement v2 — "3s ago" labels) ─────────────────────

/** "just now" / "42s ago" / "5m ago" / "2h ago" / "2d ago" — compact relative label. */
export function timeAgo(ms: number, nowMs: number = Date.now()): string {
	return timeAgoLabel(ms, nowMs);
}

// ── Duration tone (requests/SQL tables — slow = amber/red) ─────────────────

export interface DurationTone {
	readonly textClass: string;
}

/** Thresholds (ms) for the amber / red duration treatments. */
const SLOW_MS = 500;
const CRITICAL_MS = 2000;

/** Duration cell classes: muted < 500ms, amber ≥ 500ms, red ≥ 2s. */
export function durationTone(durationMs: number): DurationTone {
	if (durationMs >= CRITICAL_MS) {
		return { textClass: "font-medium text-red-600 dark:text-red-400" };
	}
	if (durationMs >= SLOW_MS) {
		return { textClass: "font-medium text-amber-600 dark:text-amber-400" };
	}
	return { textClass: "text-muted-foreground" };
}

// ── Span kind metadata (timeline colors) ───────────────────────────────────

export interface SpanKindMeta {
	readonly label: string;
	/** Bar fill classes (light + dark both readable). */
	readonly barClass: string;
}

// A categorical palette with one recognizable hue per stage (no purple/indigo
// family — adjacent indigo/sky/violet bars used to read as one big purple
// gradient). Hues stay distinct from each other so the eye can map a stage to
// a color at a glance, and they hold up on the muted track in both themes.
const SPAN_KIND_META: Readonly<Record<TelescopeSpanKind, SpanKindMeta>> = {
	middleware: { label: "Middleware", barClass: "bg-slate-400" },
	guard: { label: "Guard", barClass: "bg-amber-500" },
	interceptor: { label: "Interceptor", barClass: "bg-cyan-500" },
	service: { label: "Service", barClass: "bg-emerald-500" },
	prisma: { label: "Prisma", barClass: "bg-sky-500" },
	queue: { label: "Queue", barClass: "bg-orange-500" },
	serialization: { label: "Serialization", barClass: "bg-teal-500" },
	other: { label: "Other", barClass: "bg-zinc-400" },
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

// ── Environment tag helpers (feature 8) ────────────────────────────────────

/** Short env badge label: `development` → `dev`. */
export function envLabel(nodeEnv: string | null | undefined): string {
	if (nodeEnv === null || nodeEnv === undefined) {
		return "—";
	}
	if (nodeEnv === "production") {
		return "prod";
	}
	if (nodeEnv === "development") {
		return "dev";
	}
	return nodeEnv;
}

/** Pill classes for the env badge — token-driven (light + dark). */
export function envTone(nodeEnv: string | null | undefined): string {
	if (nodeEnv === "production") {
		return "border-amber-300/60 bg-amber-500/10 text-amber-700 dark:border-amber-500/40 dark:text-amber-400";
	}
	return "border-sky-300/60 bg-sky-500/10 text-sky-700 dark:border-sky-500/40 dark:text-sky-400";
}

// ── PII helpers (feature 17) ───────────────────────────────────────────────

const PII_LABELS: Readonly<Record<TelescopePiiCategory, string>> = {
	email: "Email",
	phone: "Phone",
	jwt: "JWT",
	ssn: "SSN",
	creditCard: "Credit card",
};

export function piiCategoryLabel(category: TelescopePiiCategory): string {
	return PII_LABELS[category];
}

// ── Snippet builder (feature 16 — cURL / fetch / axios) ────────────────────

export type RequestSnippetFormat = "curl" | "fetch" | "axios";

const SNIPPET_FORMAT_LABELS: Readonly<Record<RequestSnippetFormat, string>> = {
	curl: "cURL",
	fetch: "fetch",
	axios: "axios",
};

export function snippetFormatLabel(format: RequestSnippetFormat): string {
	return SNIPPET_FORMAT_LABELS[format];
}

export const RequestSnippetContextSchema = z
	.object({
		apiBaseUrl: z.string().min(1),
		accessToken: z.string().nullable(),
	})
	.strict();

export type RequestSnippetContext = z.output<typeof RequestSnippetContextSchema>;

/** Absolute API URL for a captured request (`http://localhost:8080/api/v1/...`). */
export function buildRequestUrl(request: RequestLogEntry, apiBaseUrl: string): string {
	const base: string = apiBaseUrl.endsWith("/") ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
	const path: string = request.path.startsWith("/") ? request.path : `/${request.path}`;
	const absolute = `${base}${path}`;
	if (request.queryString !== null && request.queryString.length > 0) {
		return `${absolute}?${request.queryString}`;
	}
	return absolute;
}

const AUTH_HEADER_NAMES: readonly string[] = ["authorization", "cookie"];

function collectSnippetHeaders(request: RequestLogEntry, accessToken: string | null): readonly { readonly key: string; readonly value: string }[] {
	const headers: { key: string; value: string }[] = [];
	const seen: Set<string> = new Set<string>();

	if (request.requestHeaders !== null) {
		for (const [key, value] of Object.entries(request.requestHeaders)) {
			const lower: string = key.toLowerCase();
			if (AUTH_HEADER_NAMES.includes(lower)) {
				continue;
			}
			headers.push({ key, value });
			seen.add(lower);
		}
	}

	if (accessToken !== null && !seen.has("authorization")) {
		headers.unshift({ key: "Authorization", value: `Bearer ${accessToken}` });
	}

	return headers;
}

/** Builds a ready-to-run request snippet from a captured request. */
export function buildRequestSnippet(request: RequestLogEntry, format: RequestSnippetFormat, context: RequestSnippetContext): string {
	const url: string = buildRequestUrl(request, context.apiBaseUrl);
	const method: string = request.method.toUpperCase();
	const headers: readonly { readonly key: string; readonly value: string }[] = collectSnippetHeaders(request, context.accessToken);
	const body: string = request.requestBody !== null ? JSON.stringify(request.requestBody) : "";

	if (format === "curl") {
		const parts: string[] = [`curl -X ${method} '${url}'`];
		for (const header of headers) {
			parts.push(`  -H '${header.key}: ${header.value}'`);
		}
		if (request.requestBody !== null) {
			parts.push(`  -d '${body}'`);
		}
		return parts.join(" \\\n");
	}

	if (format === "axios") {
		const parts: string[] = ['import axios from "axios";', "", "await axios.request({"];
		parts.push(`  method: "${method}",`);
		parts.push(`  url: "${url}",`);
		if (headers.length > 0) {
			parts.push(`  headers: ${JSON.stringify(Object.fromEntries(headers.map((header) => [header.key, header.value])), null, 2).replace(/\n/g, "\n  ")},`);
		}
		if (request.requestBody !== null) {
			parts.push(`  data: ${body},`);
		}
		parts.push("});");
		return parts.join("\n");
	}

	// fetch
	const parts: string[] = [];
	parts.push(`const response = await fetch("${url}", {`);
	parts.push(`  method: "${method}",`);
	if (headers.length > 0) {
		parts.push(`  headers: ${JSON.stringify(Object.fromEntries(headers.map((header) => [header.key, header.value])), null, 2).replace(/\n/g, "\n  ")},`);
	}
	if (request.requestBody !== null) {
		parts.push(`  body: JSON.stringify(${body}),`);
	}
	parts.push("});");
	return parts.join("\n");
}

// ── Job / schedule / alert status tones ────────────────────────────────────

/** Jobs: running → sky, succeeded → emerald, failed → red. */
export function jobStatusTone(status: string): string {
	if (status === "succeeded") {
		return "border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-400";
	}
	if (status === "failed") {
		return "border-red-300/60 bg-red-500/10 text-red-700 dark:border-red-500/40 dark:text-red-400";
	}
	return "border-sky-300/60 bg-sky-500/10 text-sky-700 dark:border-sky-500/40 dark:text-sky-400";
}

/** Schedules: pending → muted, succeeded → emerald, failed → red. */
export function scheduleStatusTone(status: string): string {
	if (status === "succeeded") {
		return "border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-400";
	}
	if (status === "failed") {
		return "border-red-300/60 bg-red-500/10 text-red-700 dark:border-red-500/40 dark:text-red-400";
	}
	return "border-border text-muted-foreground";
}

/** Exception triage status chip: open → amber, resolved → emerald, ignored → muted (improvement 6). */
export function exceptionStatusTone(status: string): string {
	if (status === "resolved") {
		return "border-emerald-300/60 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-400";
	}
	if (status === "ignored") {
		return "border-border bg-muted/40 text-muted-foreground";
	}
	return "border-amber-300/60 bg-amber-500/10 text-amber-700 dark:border-amber-500/40 dark:text-amber-400";
}

/** Alert reason chip: duration → amber, error/job → red. */
export function alertReasonTone(reason: string): string {
	if (reason === "error" || reason === "job") {
		return "border-red-300/60 bg-red-500/10 text-red-700 dark:border-red-500/40 dark:text-red-400";
	}
	return "border-amber-300/60 bg-amber-500/10 text-amber-700 dark:border-amber-500/40 dark:text-amber-400";
}

/**
 * The route a live-feed frame should navigate to, or null when the frame is
 * not navigable (schedule runs, jobs with no correlation). Shared by every
 * page that renders a `LiveFeed` so the click targets stay consistent:
 * - exception → exceptions list,
 * - request → its detail page,
 * - job → the correlated request on the requests page (via `?correlation=`).
 */
export function streamEventTarget(event: TelescopeStreamEvent): string | null {
	if (event.type === "exception") {
		return "/telescope/exceptions";
	}
	if (event.type === "request") {
		return `/telescope/requests/${encodeURIComponent(event.id)}`;
	}
	if (event.type === "job" && event.correlationId !== null) {
		return `/telescope/requests?correlation=${encodeURIComponent(event.correlationId)}`;
	}
	return null;
}
