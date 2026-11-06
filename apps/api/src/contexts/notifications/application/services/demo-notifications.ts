import type { NotificationAttachment } from "@workspace/shared";

import type { Clock } from "../../../../platform/application/clock.port";
import { SHOWCASE_NOTIFICATION, TEST_NOTIFICATION, type ShowcasePayload } from "../../domain/catalog/types/platform.types";
import { NEW_SIGN_IN_NOTIFICATION } from "../../domain/catalog/types/security.types";
import type { NotificationQueues } from "../ports/notification-queues.port";
import type { NotificationRecipient, NotifyResult, NotifyTransactionalPort } from "../ports/notify.port";

// ── Demo notifications (development tooling, ADR 070) ──
// `pnpm --filter @workspace/api notifications:demo` gives one person a few real notifications to look at:
// each goes through notify() and the normal fan-out, so it lands in every inbox the person has (the
// mobile app's and the admin panel's), on their registered phones and in Mailpit — exactly like one the
// API sends. Only types shown on every surface are used, and none that point at another row. When the seed has run,
// the set also holds three messages with a 4K photo and one with a PDF.

/** Allowlisted system operation the demo runs under: read the person, write their notifications. */
export const NOTIFICATIONS_DEMO_OPERATION = "notifications.demo";

/** Who the demo goes to: one person by email, or the platform's only superadmin. */
export type DemoRecipientQuery = { readonly kind: "email"; readonly email: string } | { readonly kind: "sole-superadmin" };

export type DemoRecipientLookup =
	| { readonly kind: "found"; readonly userId: string; readonly email: string }
	| { readonly kind: "not-found" }
	/** No email was given and the platform has no superadmin, or several. */
	| { readonly kind: "ambiguous"; readonly superadmins: "none" | "several" };

/** How many messages carry a photo. */
export const SHOWCASE_PHOTO_COUNT = 3;
/** 4K wide: what the demo photos are at least. */
export const SHOWCASE_PHOTO_MIN_WIDTH = 3840;

/** The words of the demo messages with an attachment: the first three go with photos, the last with a PDF. */
export const SHOWCASE_MESSAGES: readonly ShowcasePayload[] = [
	{ title: "Fresh from the kitchen", body: "A first look at this week's special. Tap the photo to see it in full 4K." },
	{ title: "Back on the menu", body: "An old favourite returns on Saturday, and here's what it looks like." },
	{ title: "Worth the trip", body: "One of our customers' favourite treats this month, photographed in 4K." },
	{ title: "Your October statement", body: "Your points for October are ready. The statement is attached as a PDF." },
];

/** What the demo needs from the database. */
export interface DemoNotificationsStore {
	findRecipient(query: DemoRecipientQuery): Promise<DemoRecipientLookup>;
	/** The seeded files to attach, in {@link SHOWCASE_MESSAGES}' order: the photos, then the PDF. Empty before a seed. */
	findShowcaseAttachments(): Promise<readonly NotificationAttachment[]>;
	/** Runs `work` on ONE transaction under {@link NOTIFICATIONS_DEMO_OPERATION}, with `notify()` bound to it. */
	inTransaction<T>(work: (notify: NotifyTransactionalPort) => Promise<T>): Promise<T>;
}

export type DemoNotificationsOutcome =
	| {
			readonly kind: "sent";
			readonly email: string;
			readonly notificationIds: readonly string[];
			/** How many were handed to the fan-out queue at once; the rest go out on the API's minute maintenance run. */
			readonly handedOff: number;
	  }
	| { readonly kind: "not-found" }
	| { readonly kind: "ambiguous"; readonly superadmins: "none" | "several" };

const MINUTE_MS = 60_000;
/** The demo's second sign-in happened this long ago, so the inbox shows two different times. */
const EARLIER_SIGN_IN_AGO_MS = 95 * MINUTE_MS;
/** The dedupe keys after the three plain notifications'. */
const SHOWCASE_DEDUPE_OFFSET = 3;

/** The demo set, newest first: two sign-ins on different devices, then a test notification. One transaction, in order. */
async function requestDemo(notify: NotifyTransactionalPort, userId: string, now: number, attachments: readonly NotificationAttachment[]): Promise<readonly (string | null)[]> {
	const recipient: NotificationRecipient = { kind: "user", userId };
	const dedupe = (index: number): string => `demo:${userId}:${String(now)}:${String(index)}`;
	const latestSignIn = await notify.notify({
		type: NEW_SIGN_IN_NOTIFICATION,
		recipient,
		payload: { device: "Chrome on macOS", location: "Kuala Lumpur, Malaysia", signedInAt: now },
		dedupeKey: dedupe(0),
		tenantId: null,
	});
	const earlierSignIn = await notify.notify({
		type: NEW_SIGN_IN_NOTIFICATION,
		recipient,
		payload: { device: "Safari on iPhone", location: "George Town, Penang, Malaysia", signedInAt: now - EARLIER_SIGN_IN_AGO_MS },
		dedupeKey: dedupe(1),
		tenantId: null,
	});
	const test = await notify.notify({ type: TEST_NOTIFICATION, recipient, payload: { requestedBy: "the demo notifications command" }, dedupeKey: dedupe(2), tenantId: null });
	const showcase: NotifyResult[] = [];
	for (const [position, attachment] of attachments.entries()) {
		const payload = SHOWCASE_MESSAGES.at(position);
		if (payload !== undefined) {
			showcase.push(
				await notify.notify({ type: SHOWCASE_NOTIFICATION, recipient, payload, dedupeKey: dedupe(position + SHOWCASE_DEDUPE_OFFSET), tenantId: null, attachment }),
			);
		}
	}
	return [latestSignIn, earlierSignIn, test, ...showcase].map((result: NotifyResult): string | null => (result.duplicate ? null : result.notificationId));
}

/** Sends one person the demo notifications. */
export class DemoNotificationsSender {
	public constructor(
		private readonly store: DemoNotificationsStore,
		/** The fan-out queue (BullMQ); null when Redis is not configured — the maintenance run then delivers them. */
		private readonly queues: Pick<NotificationQueues, "fanOut"> | null,
		private readonly clock: Clock,
	) {}

	public async send(query: DemoRecipientQuery): Promise<DemoNotificationsOutcome> {
		const recipient = await this.store.findRecipient(query);
		if (recipient.kind !== "found") {
			return recipient;
		}
		const now = this.clock.now();
		const attachments = await this.store.findShowcaseAttachments();
		const written = await this.store.inTransaction((notify) => requestDemo(notify, recipient.userId, now, attachments));
		const notificationIds = written.filter((id): id is string => id !== null);
		let handedOff = 0;
		for (const notificationId of notificationIds) {
			handedOff += (await this.handOff(notificationId)) ? 1 : 0;
		}
		return { kind: "sent", email: recipient.email, notificationIds, handedOff };
	}

	/** Like the API's after-commit hand-off: best effort — a row not handed off is swept by the maintenance run. */
	private async handOff(notificationId: string): Promise<boolean> {
		if (this.queues === null) {
			return false;
		}
		try {
			await this.queues.fanOut(notificationId);
			return true;
		} catch {
			return false;
		}
	}
}
