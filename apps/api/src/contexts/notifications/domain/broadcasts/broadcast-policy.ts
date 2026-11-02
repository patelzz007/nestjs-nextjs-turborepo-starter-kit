// ============================================
// notifications/domain/broadcasts/broadcast-policy.ts — the rules a broadcast must keep (ADR 073)
// ============================================
// Pure: links, the weekly allowance, the report threshold that pauses a broadcast, the strike window
// that turns a tenant's broadcasting off, when sending may start, and the lifecycle's allowed moves.

import {
	BROADCAST_REPORT_PAUSE_COUNT,
	BROADCAST_REPORT_PAUSE_SHARE,
	BROADCAST_STRIKE_WINDOW_DAYS,
	BroadcastStatusSchema,
	DAY_MS,
	richTextLinks,
	type BroadcastLinkProblem,
	type BroadcastStatus,
	type RichTextDocument,
} from "@workspace/shared";

/** Strikes count within this window. */
export const BROADCAST_STRIKE_WINDOW_MS = BROADCAST_STRIKE_WINDOW_DAYS * DAY_MS;

/** The earliest any time zone reaches a wall-clock time (UTC+14): local-time sending starts this early. */
const EARLIEST_UTC_OFFSET_HOURS = 14;
const MS_PER_HOUR = 3_600_000;
export const LOCAL_TIME_LEAD_MS = EARLIEST_UTC_OFFSET_HOURS * MS_PER_HOUR;

/** Link shorteners hide where a link really leads: never allowed in a broadcast. */
export const URL_SHORTENER_DOMAINS: readonly string[] = [
	"bit.ly",
	"t.co",
	"tinyurl.com",
	"goo.gl",
	"ow.ly",
	"is.gd",
	"buff.ly",
	"rebrand.ly",
	"cutt.ly",
	"shorturl.at",
	"s.id",
	"rb.gy",
	"t.ly",
	"tiny.cc",
	"lnkd.in",
];

/** Whether `host` is `domain` or one of its subdomains. */
function isDomainOrSubdomain(host: string, domain: string): boolean {
	return host === domain || host.endsWith(`.${domain}`);
}

/** Every link that may not be sent, each named exactly (checked on save and again on send). */
export function broadcastLinkProblems(document: RichTextDocument, blockedDomains: readonly string[]): BroadcastLinkProblem[] {
	return richTextLinks(document).flatMap((href: string): BroadcastLinkProblem[] => {
		if (!URL.canParse(href)) {
			return [{ href, problem: "not-https" }];
		}
		const url = new URL(href);
		if (url.protocol !== "https:") {
			return [{ href, problem: "not-https" }];
		}
		const host = url.hostname.toLowerCase();
		if (URL_SHORTENER_DOMAINS.some((domain: string): boolean => isDomainOrSubdomain(host, domain))) {
			return [{ href, problem: "shortener" }];
		}
		if (blockedDomains.some((domain: string): boolean => isDomainOrSubdomain(host, domain.toLowerCase()))) {
			return [{ href, problem: "blocked-domain" }];
		}
		return [];
	});
}

const DAYS_PER_WEEK = 7;
/** ISO weekdays run Monday 1 … Sunday 7; JavaScript's Sunday is 0. */
const ISO_SUNDAY = 7;
const ISO_THURSDAY = 4;

/** The ISO week (`2026-W44`) of an instant, in UTC: the weekly allowance counts per ISO week. */
export function isoWeek(epochMs: number): string {
	const date = new Date(epochMs);
	const day = date.getUTCDay() === 0 ? ISO_SUNDAY : date.getUTCDay();
	// The Thursday of this week decides the ISO year and week.
	const thursday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + ISO_THURSDAY - day));
	const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
	const week = Math.ceil(((thursday.getTime() - yearStart) / DAY_MS + 1) / DAYS_PER_WEEK);
	return `${String(thursday.getUTCFullYear())}-W${String(week).padStart(2, "0")}`;
}

/** Open reports that pause a broadcast: 10, or 1% of its audience, whichever comes first (at least one). */
export function reportPauseThreshold(audienceCount: number): number {
	return Math.max(1, Math.min(BROADCAST_REPORT_PAUSE_COUNT, Math.ceil(audienceCount * BROADCAST_REPORT_PAUSE_SHARE)));
}

/** Where a broadcast may go from each status (staff and the sender; SENDING and SENT only by the sender job). */
const ALLOWED_MOVES: Readonly<Record<BroadcastStatus, readonly BroadcastStatus[]>> = {
	DRAFT: ["PENDING_APPROVAL", "SCHEDULED", "CANCELLED"],
	PENDING_APPROVAL: ["SCHEDULED", "DRAFT", "CANCELLED"],
	SCHEDULED: ["SENDING", "CANCELLED", "PAUSED", "DRAFT"],
	SENDING: ["SENT", "PAUSED", "FAILED"],
	PAUSED: ["SCHEDULED", "SENDING", "CANCELLED"],
	SENT: ["PAUSED"],
	CANCELLED: [],
	FAILED: [],
};

export function canMoveBroadcast(from: BroadcastStatus, to: BroadcastStatus): boolean {
	return ALLOWED_MOVES[from].includes(to);
}

/** The statuses a broadcast may be moved to `to` from (an optimistic, race-free update). */
export function broadcastStatusesBefore(to: BroadcastStatus): BroadcastStatus[] {
	return BroadcastStatusSchema.options.filter((from: BroadcastStatus): boolean => ALLOWED_MOVES[from].includes(to));
}

/** When a scheduled broadcast may start sending: at its instant, or early enough for UTC+14 to reach its local time. */
export function broadcastStartsAt(sendMode: "INSTANT" | "RECIPIENT_LOCAL_TIME", sendAt: number | null, localSendAt: number | null, scheduledAt: number): number {
	if (sendMode === "RECIPIENT_LOCAL_TIME" && localSendAt !== null) {
		return localSendAt - LOCAL_TIME_LEAD_MS;
	}
	return sendAt ?? scheduledAt;
}
