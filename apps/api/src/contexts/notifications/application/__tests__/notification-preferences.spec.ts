import { epochMs, type EpochMs, type InAppNotificationSignal, type NotificationCategory } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../platform/application/actor-context";
import { ValidationError } from "../../../../platform/application/errors/app-error";
import type { ChannelSendResult, PushSender } from "../ports/channel-senders.port";
import type { InAppSignalPort } from "../ports/in-app-signal.port";
import type { PushTokenCipher } from "../ports/push-token-cipher.port";
import { NotificationAccountService, type UnsubscribeVerifier } from "../services/notification-account.service";
import { InMemoryNotificationAccountStore } from "./fakes/in-memory-notification-account.store";
import { InMemoryEmailLogs, notificationsScope, RecordingNotificationsUnitOfWork } from "./fakes/notifications.fakes";

const NOW = Date.UTC(2026, 10, 1, 9);
const STAFF = "0193f2c4-0000-7000-8000-0000000000e1";
const CUSTOMER = "0193f2c4-0000-7000-8000-0000000000e2";

class NotUsed extends Error {}

/** The preferences never signal, push, decrypt or verify an unsubscribe. */
const SIGNALS: InAppSignalPort = {
	publish: (_userId: string, _signal: InAppNotificationSignal): Promise<void> => Promise.reject(new NotUsed("signals.publish")),
	subscribe: (): (() => void) => {
		throw new NotUsed("signals.subscribe");
	},
};
const PUSH: PushSender = {
	provider: "none",
	live: false,
	send: (): Promise<ChannelSendResult> => Promise.reject(new NotUsed("push.send")),
	sendSilentSync: (): Promise<ChannelSendResult> => Promise.reject(new NotUsed("push.sendSilentSync")),
};
const CIPHER: PushTokenCipher = {
	available: false,
	encrypt: (): string => {
		throw new NotUsed("cipher.encrypt");
	},
	decrypt: (): string => {
		throw new NotUsed("cipher.decrypt");
	},
};
const UNSUBSCRIBE: UnsubscribeVerifier = {
	verify: () => {
		throw new NotUsed("unsubscribe.verify");
	},
};

function user(userId: string): ActorContext {
	return {
		kind: "user",
		userId,
		sessionId: "session-1",
		tenantId: null,
		isSuperAdmin: false,
		accessScope: "tenant",
		impersonatorUserId: null,
		request: { requestId: "req-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
	};
}

function service(): { readonly accounts: NotificationAccountService; readonly store: InMemoryNotificationAccountStore } {
	const store = new InMemoryNotificationAccountStore();
	store.adminPanelUsers.add(STAFF);
	const uow = new RecordingNotificationsUnitOfWork(notificationsScope(new InMemoryEmailLogs(), undefined, undefined, store));
	return { accounts: new NotificationAccountService(uow, { now: (): EpochMs => epochMs(NOW) }, SIGNALS, PUSH, CIPHER, UNSUBSCRIBE), store };
}

function categoriesOf(rows: readonly { readonly category: NotificationCategory }[]): readonly NotificationCategory[] {
	return rows.map((row) => row.category);
}

describe("notification preferences: the operations alerts (ADR 070)", () => {
	it("shows the admin panel's people an Operations row, always on in the app and on the phone", async () => {
		const { accounts } = service();

		const preferences = await accounts.preferences(user(STAFF), null);

		const operations = preferences.categories.find((row) => row.category === "OPERATIONS");
		expect(operations?.channels.find((cell) => cell.channel === "IN_APP")).toMatchObject({ enabled: true, locked: true, reason: "mandatory" });
		expect(operations?.channels.find((cell) => cell.channel === "PUSH")).toMatchObject({ locked: true, reason: "mandatory" });
		expect(operations?.channels.find((cell) => cell.channel === "EMAIL")).toMatchObject({ enabled: true, locked: false, reason: null });
		expect(operations?.channels.find((cell) => cell.channel === "SMS")).toMatchObject({ available: false, reason: "not-offered" });
	});

	it("leaves the row out for everybody else", async () => {
		const { accounts } = service();

		const preferences = await accounts.preferences(user(CUSTOMER), null);

		expect(categoriesOf(preferences.categories)).toEqual(["SECURITY", "ACCOUNT", "TRANSACTIONAL", "PRODUCT", "MARKETING"]);
	});

	it("refuses to turn the alerts off in the app or on the phone, and lets their email go", async () => {
		const { accounts, store } = service();

		await expect(accounts.updatePreferences(user(STAFF), { tenantId: null, changes: [{ category: "OPERATIONS", channel: "PUSH", enabled: false }] })).rejects.toBeInstanceOf(
			ValidationError,
		);
		const after = await accounts.updatePreferences(user(STAFF), { tenantId: null, changes: [{ category: "OPERATIONS", channel: "EMAIL", enabled: false }] });

		expect(after.categories.find((row) => row.category === "OPERATIONS")?.channels.find((cell) => cell.channel === "EMAIL")?.enabled).toBe(false);
		expect(await store.preferences(STAFF)).toEqual([{ tenantKey: "platform", category: "OPERATIONS", channel: "EMAIL", enabled: false }]);
	});
});
