import { epochMs, type JsonObject } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import { NOTIFICATION_CATALOG } from "../../domain/catalog/notification-catalog";
import type { NotificationQueues } from "../ports/notification-queues.port";
import type { NotifyRequest, NotifyResult, NotifyTransactionalPort } from "../ports/notify.port";
import { DemoNotificationsSender, type DemoNotificationsStore, type DemoRecipientLookup, type DemoRecipientQuery } from "../services/demo-notifications";

const NOW = epochMs(1_800_000_000_000);
const USER_ID = "0b6a3c55-2f1d-4e8a-a7b9-5c4d3e2f1a10";
const EMAIL = "superadmin@example.com";

interface WrittenNotification {
	readonly id: string;
	readonly typeKey: string;
	readonly recipientUserId: string | null;
	readonly dedupeKey: string;
	readonly tenantId: string | null;
	readonly payload: JsonObject;
}

/** notify() that keeps what it was asked, with a new id each time (and a repeat answered as a duplicate). */
class WritingNotify implements NotifyTransactionalPort {
	public constructor(private readonly written: WrittenNotification[]) {}

	public notify<TPayload>(request: NotifyRequest<TPayload>): Promise<NotifyResult> {
		if (this.written.some((row) => row.dedupeKey === request.dedupeKey)) {
			return Promise.resolve({ duplicate: true });
		}
		const id = `notification-${String(this.written.length + 1)}`;
		this.written.push({
			id,
			typeKey: request.type.key,
			recipientUserId: request.recipient.kind === "user" ? request.recipient.userId : null,
			dedupeKey: request.dedupeKey,
			tenantId: request.tenantId,
			payload: request.type.declaration.toJson(request.payload),
		});
		return Promise.resolve({ duplicate: false, notificationId: id });
	}
}

class FakeStore implements DemoNotificationsStore {
	public readonly written: WrittenNotification[] = [];
	public readonly queries: DemoRecipientQuery[] = [];
	public transactions = 0;

	public constructor(private readonly lookup: DemoRecipientLookup) {}

	public findRecipient(query: DemoRecipientQuery): Promise<DemoRecipientLookup> {
		this.queries.push(query);
		return Promise.resolve(this.lookup);
	}

	public inTransaction<T>(work: (notify: NotifyTransactionalPort) => Promise<T>): Promise<T> {
		this.transactions += 1;
		return work(new WritingNotify(this.written));
	}
}

class RecordingQueues implements Pick<NotificationQueues, "fanOut"> {
	public readonly handedOff: string[] = [];

	public constructor(private readonly failing: ReadonlySet<string> = new Set()) {}

	public fanOut(notificationId: string): Promise<void> {
		if (this.failing.has(notificationId)) {
			return Promise.reject(new Error("Redis is down"));
		}
		this.handedOff.push(notificationId);
		return Promise.resolve();
	}
}

const FOUND: DemoRecipientLookup = { kind: "found", userId: USER_ID, email: EMAIL };

describe("DemoNotificationsSender", () => {
	it("requests two sign-ins and a test notification for the person, on one transaction, and hands each to the fan-out", async () => {
		const store = new FakeStore(FOUND);
		const queues = new RecordingQueues();

		const outcome = await new DemoNotificationsSender(store, queues, new FixedClock(NOW)).send({ kind: "sole-superadmin" });

		expect(store.transactions).toBe(1);
		expect(store.written.map((row) => row.typeKey)).toEqual(["security.new-sign-in", "security.new-sign-in", "notifications.test"]);
		expect(store.written.every((row) => row.recipientUserId === USER_ID && row.tenantId === null)).toBe(true);
		expect(queues.handedOff).toEqual(["notification-1", "notification-2", "notification-3"]);
		expect(outcome).toEqual({ kind: "sent", email: EMAIL, notificationIds: ["notification-1", "notification-2", "notification-3"], handedOff: 3 });
	});

	it("uses only types every inbox shows — the mobile app's (CUSTOMER) and the admin panel's (ADMIN)", async () => {
		const store = new FakeStore(FOUND);
		await new DemoNotificationsSender(store, null, new FixedClock(NOW)).send({ kind: "sole-superadmin" });

		for (const { typeKey } of store.written) {
			const type = NOTIFICATION_CATALOG.find((candidate) => candidate.key === typeKey);
			expect(type?.surfaces, typeKey).toEqual(expect.arrayContaining(["CUSTOMER", "ADMIN"]));
			expect(type?.channels, typeKey).toContain("IN_APP");
		}
	});

	it("dates the sign-ins now and earlier, so the inbox shows two different times", async () => {
		const store = new FakeStore(FOUND);
		await new DemoNotificationsSender(store, null, new FixedClock(NOW)).send({ kind: "sole-superadmin" });

		const [latest, earlier] = store.written;
		expect(latest?.payload).toMatchObject({ device: "Chrome on macOS", signedInAt: NOW });
		expect(earlier?.payload.signedInAt).toBeLessThan(NOW);
	});

	it("sends a fresh set on every run (dedupe keys carry the run's time)", async () => {
		const store = new FakeStore(FOUND);
		await new DemoNotificationsSender(store, null, new FixedClock(NOW)).send({ kind: "sole-superadmin" });
		await new DemoNotificationsSender(store, null, new FixedClock(epochMs(NOW + 1))).send({ kind: "sole-superadmin" });

		expect(new Set(store.written.map((row) => row.dedupeKey)).size).toBe(6);
	});

	it("leaves a notification the queue refused to the maintenance run, and still reports it sent", async () => {
		const store = new FakeStore(FOUND);
		const queues = new RecordingQueues(new Set(["notification-2"]));

		const outcome = await new DemoNotificationsSender(store, queues, new FixedClock(NOW)).send({ kind: "email", email: EMAIL });

		expect(outcome).toMatchObject({ kind: "sent", handedOff: 2 });
		expect(store.written).toHaveLength(3);
	});

	it("hands nothing off without a queue (no Redis): the maintenance run delivers them", async () => {
		const outcome = await new DemoNotificationsSender(new FakeStore(FOUND), null, new FixedClock(NOW)).send({ kind: "sole-superadmin" });
		expect(outcome).toMatchObject({ kind: "sent", handedOff: 0 });
	});

	it("writes nothing when the person cannot be found or no single superadmin is the default", async () => {
		for (const lookup of [{ kind: "not-found" }, { kind: "ambiguous", superadmins: "several" }] satisfies DemoRecipientLookup[]) {
			const store = new FakeStore(lookup);
			const outcome = await new DemoNotificationsSender(store, new RecordingQueues(), new FixedClock(NOW)).send({ kind: "email", email: EMAIL });
			expect(outcome).toEqual(lookup);
			expect(store.transactions).toBe(0);
		}
	});
});
