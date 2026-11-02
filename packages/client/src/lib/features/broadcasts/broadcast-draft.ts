// What every broadcast composer shares (ADR 073), the merchant's and the platform's: when it goes out
// and how that maps to the API's send fields, the body from the editor, the channels, and the words each
// state is shown in. Each composer adds its own audience.

import {
	BroadcastChannelSchema,
	BroadcastDraftSchema,
	instantOfWallClock,
	LIST_SLOT_INDEX,
	RichTextDocumentSchema,
	type BroadcastAudience,
	type BroadcastChannel,
	type BroadcastDraftInput,
	type BroadcastResponse,
	type BroadcastSendMode,
	type BroadcastStatus,
	type RichTextDocument,
} from "@workspace/shared";
import { z } from "zod";

/** When it goes out: as soon as it is scheduled, at a set time, or at a set time in each recipient's own zone. */
export const BroadcastTimingSchema = z.enum(["now", "at-time", "recipient-local-time"]);
export type BroadcastTiming = z.output<typeof BroadcastTimingSchema>;

/** The composer's timing fields. Dates are `yyyy-MM-dd`, times `HH:mm`. */
export interface BroadcastScheduleValues {
	readonly timing: BroadcastTiming;
	readonly sendDate: string;
	readonly sendTime: string;
}

/** A new broadcast's time when one is set: nine in the morning. */
export const BROADCAST_DEFAULT_SEND_TIME = "09:00";

/** Every channel a broadcast can use, in the order the composers list them (never SMS). */
export const BROADCAST_CHANNEL_OPTIONS: readonly BroadcastChannel[] = BroadcastChannelSchema.options;

export const BROADCAST_CHANNEL_LABELS: Readonly<Record<BroadcastChannel, string>> = {
	IN_APP: "In the app",
	EMAIL: "Email",
	PUSH: "Phone notification",
};

/** `yyyy-MM-dd` + `HH:mm` as a floating wall-clock instant (written as if UTC), or null when either is malformed. */
export function wallClockOf(date: string, time: string): number | null {
	const dateParts = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/u.exec(date)?.groups;
	const timeParts = /^(?<hour>\d{2}):(?<minute>\d{2})$/u.exec(time)?.groups;
	if (dateParts === undefined || timeParts === undefined) {
		return null;
	}
	return Date.UTC(Number(dateParts.year), Number(dateParts.month) - 1, Number(dateParts.day), Number(timeParts.hour), Number(timeParts.minute));
}

export interface BroadcastTimingFields {
	readonly sendMode: BroadcastSendMode;
	readonly sendAt: number | null;
	readonly localSendAt: number | null;
}

/** The send fields: an instant in the sender's zone, or a floating local time for each recipient. */
export function broadcastTimingFields(values: BroadcastScheduleValues, senderTimeZone: string): BroadcastTimingFields {
	const wallClock = wallClockOf(values.sendDate, values.sendTime);
	switch (values.timing) {
		case "now":
			return { sendMode: "INSTANT", sendAt: null, localSendAt: null };
		case "at-time":
			return { sendMode: "INSTANT", sendAt: wallClock === null ? null : instantOfWallClock(wallClock, senderTimeZone), localSendAt: null };
		case "recipient-local-time":
			return { sendMode: "RECIPIENT_LOCAL_TIME", sendAt: null, localSendAt: wallClock };
	}
}

/** What is wrong with the send time, in the sender's words, or null when it is fine. */
export function broadcastScheduleProblemOf(values: BroadcastScheduleValues, senderTimeZone: string, now: number): string | null {
	if (values.timing === "now") {
		return null;
	}
	if (wallClockOf(values.sendDate, values.sendTime) === null) {
		return "Pick a date and a time.";
	}
	const { sendAt } = broadcastTimingFields(values, senderTimeZone);
	return values.timing === "at-time" && sendAt !== null && sendAt <= now ? "Pick a time that has not passed yet." : null;
}

/** The fields of a composer a message points at. */
export type BroadcastComposerField = "title" | "body" | "audience" | "channels" | "schedule";

export type BroadcastComposerErrors = Readonly<Partial<Record<BroadcastComposerField, string>>>;

export type BroadcastDraftResult = { readonly ok: true; readonly draft: BroadcastDraftInput } | { readonly ok: false; readonly errors: BroadcastComposerErrors };

/** What a composer puts together: the message, its own audience and kind, and what it found wrong with the audience. */
export interface BroadcastDraftParts {
	readonly title: string;
	readonly body: RichTextDocument | null;
	readonly channels: readonly BroadcastChannel[];
	readonly schedule: BroadcastScheduleValues;
	readonly audience: BroadcastAudience;
	readonly category: BroadcastDraftInput["category"];
	/** The composer's own audience check ("pick at least one customer"), or null. */
	readonly audienceProblem: string | null;
}

/** Names the composer field a draft-schema issue belongs to. */
function fieldOfIssue(path: readonly PropertyKey[]): BroadcastComposerField {
	const head = path.at(LIST_SLOT_INDEX.first);
	if (head === "title" || head === "body" || head === "channels" || head === "audience") {
		return head;
	}
	return "schedule";
}

const ISSUE_MESSAGES: Readonly<Partial<Record<BroadcastComposerField, string>>> = {
	title: "Give it a title.",
	channels: "Choose at least one way to send it.",
	audience: "Choose who gets it.",
};

/**
 * The draft the API receives, or what is still missing, in the sender's words. The shared draft schema
 * decides validity; the composer adds the checks that need its own context (an empty pick, a set time
 * already past). The server checks everything again.
 */
export function buildBroadcastDraft(parts: BroadcastDraftParts, senderTimeZone: string, now: number): BroadcastDraftResult {
	const errors: Partial<Record<BroadcastComposerField, string>> = {};
	if (parts.body === null) {
		errors.body = "Write the message.";
	}
	if (parts.audienceProblem !== null) {
		errors.audience = parts.audienceProblem;
	}
	const scheduleProblem = broadcastScheduleProblemOf(parts.schedule, senderTimeZone, now);
	if (scheduleProblem !== null) {
		errors.schedule = scheduleProblem;
	}
	const parsed = BroadcastDraftSchema.safeParse({
		title: parts.title,
		body: parts.body ?? { type: "doc", content: [] },
		audience: parts.audience,
		channels: [...parts.channels],
		category: parts.category,
		...broadcastTimingFields(parts.schedule, senderTimeZone),
	});
	if (!parsed.success) {
		for (const issue of parsed.error.issues) {
			const field = fieldOfIssue(issue.path);
			errors[field] ??= ISSUE_MESSAGES[field] ?? issue.message;
		}
	}
	return parsed.success && Object.keys(errors).length === 0 ? { ok: true, draft: parsed.data } : { ok: false, errors };
}

/** The editor's JSON as a broadcast body, or null while it is empty or holds something a broadcast may not. */
export function toBroadcastBody(content: object): RichTextDocument | null {
	const parsed = RichTextDocumentSchema.safeParse(content);
	return parsed.success && hasText(parsed.data) ? parsed.data : null;
}

function hasText(document: RichTextDocument): boolean {
	return JSON.stringify(document.content).includes('"text"') || document.content.some((block) => block.type === "callToAction" || block.type === "image");
}

/** A saved broadcast's send time back in the composer's fields. */
export function broadcastScheduleValuesOf(broadcast: BroadcastResponse, senderTimeZone: string, fallback: BroadcastScheduleValues): BroadcastScheduleValues {
	if (broadcast.sendMode === "RECIPIENT_LOCAL_TIME" && broadcast.localSendAt !== null) {
		return { timing: "recipient-local-time", ...splitWallClock(broadcast.localSendAt) };
	}
	if (broadcast.sendAt !== null) {
		return { timing: "at-time", ...splitWallClock(wallClockInZone(broadcast.sendAt, senderTimeZone)) };
	}
	return { timing: "now", sendDate: fallback.sendDate, sendTime: fallback.sendTime };
}

/** An instant as the wall clock reads it in `timeZone`, written as if UTC. */
function wallClockInZone(instant: number, timeZone: string): number {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(instant);
	const part = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((entry) => entry.type === type)?.value ?? 0);
	return Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"));
}

function splitWallClock(wallClock: number): { readonly sendDate: string; readonly sendTime: string } {
	const iso = new Date(wallClock).toISOString();
	return { sendDate: iso.slice(0, "yyyy-MM-dd".length), sendTime: iso.slice("yyyy-MM-ddT".length, "yyyy-MM-ddTHH:mm".length) };
}

export const BROADCAST_STATUS_LABELS: Readonly<Record<BroadcastStatus, string>> = {
	DRAFT: "Draft",
	PENDING_APPROVAL: "Waiting for approval",
	SCHEDULED: "Scheduled",
	SENDING: "Sending",
	SENT: "Sent",
	PAUSED: "Paused",
	CANCELLED: "Cancelled",
	FAILED: "Failed",
};

/** Whether the sender can still change the message (only before it is scheduled). */
export function isBroadcastEditable(status: BroadcastStatus): boolean {
	return status === "DRAFT";
}

/** Whether the sender can stop it (anything not yet finished). */
export function isBroadcastCancellable(status: BroadcastStatus): boolean {
	return status === "PENDING_APPROVAL" || status === "SCHEDULED" || status === "PAUSED" || status === "SENDING";
}

/** Totals across channels of a sent broadcast: how many were reached, and how many could not be. */
export function broadcastTotals(broadcast: BroadcastResponse): { readonly delivered: number; readonly failed: number; readonly suppressed: number } {
	return broadcast.results.reduce(
		(totals, result) => ({
			delivered: totals.delivered + result.delivered,
			failed: totals.failed + result.failed,
			suppressed: totals.suppressed + result.suppressed.reduce((sum, entry) => sum + entry.count, 0),
		}),
		{ delivered: 0, failed: 0, suppressed: 0 },
	);
}

/** How a floating wall-clock time reads ("3 Nov 2026, 09:00"): it is written as if UTC, so it is shown in UTC. */
const WALL_CLOCK_FORMAT = new Intl.DateTimeFormat("en-GB", {
	timeZone: "UTC",
	day: "numeric",
	month: "short",
	year: "numeric",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
});

export function formatWallClock(wallClock: number): string {
	return WALL_CLOCK_FORMAT.format(wallClock);
}
