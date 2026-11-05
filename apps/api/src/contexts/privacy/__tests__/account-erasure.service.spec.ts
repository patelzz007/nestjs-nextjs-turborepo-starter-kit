import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { ActorContextSchema, systemActor, type ActorContext } from "../../../platform/application/actor-context";
import type { Clock } from "../../../platform/application/clock.port";
import { PersonalDataErasureRegistry, type ErasureAccountGateway } from "../../../platform/application/personal-data/personal-data-erasure.registry";
import type { AccountErasureRecord, AccountErasureStore, NewAccountErasure } from "../application/ports/account-erasure.store";
import { ACCOUNT_ERASURE_GRACE_MS, AccountErasureService } from "../application/services/account-erasure.service";

const NOW = Date.UTC(2026, 10, 3, 10, 0);
const PASSWORD = "correct horse battery staple";
const META = { requestId: "corr-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null };

function person(userId: string, impersonatorUserId: string | null = null): ActorContext {
	return ActorContextSchema.parse({ kind: "user", userId, sessionId: "s-1", tenantId: null, isSuperAdmin: false, accessScope: "tenant", impersonatorUserId, request: META });
}
const CRON = systemActor("privacy.account.erase", "cron", null, "test", null);

/** Erasure requests in memory. */
class InMemoryErasures implements AccountErasureStore {
	public readonly rows = new Map<string, AccountErasureRecord>();
	public readonly masked: string[] = [];

	public latestOwn(_person: ActorContext, userId: string): Promise<AccountErasureRecord | null> {
		return Promise.resolve([...this.rows.values()].filter((row) => row.userId === userId).at(-1) ?? null);
	}
	public latestOf(_actor: ActorContext, userId: string): Promise<AccountErasureRecord | null> {
		return Promise.resolve([...this.rows.values()].filter((row) => row.userId === userId).at(-1) ?? null);
	}
	public findOpen(_actor: ActorContext, userId: string): Promise<AccountErasureRecord | null> {
		return Promise.resolve([...this.rows.values()].find((row) => row.userId === userId && row.status === "PENDING") ?? null);
	}
	public create(_actor: ActorContext, request: NewAccountErasure): Promise<AccountErasureRecord> {
		const row: AccountErasureRecord = { ...request, status: "PENDING", cancelledAt: null, cancelledByUserId: null, completedAt: null };
		this.rows.set(row.id, row);
		return Promise.resolve(row);
	}
	public cancel(_actor: ActorContext, id: string, cancelledByUserId: string, at: number): Promise<AccountErasureRecord> {
		return Promise.resolve(this.update(id, { status: "CANCELLED", cancelledAt: at, cancelledByUserId }));
	}
	public due(_actor: ActorContext, now: number): Promise<readonly AccountErasureRecord[]> {
		return Promise.resolve([...this.rows.values()].filter((row) => row.status === "PENDING" && row.scheduledFor <= now));
	}
	public maskInKeptRecords(_actor: ActorContext, userId: string): Promise<number> {
		this.masked.push(userId);
		return Promise.resolve(1);
	}
	public complete(_actor: ActorContext, id: string, at: number): Promise<AccountErasureRecord> {
		return Promise.resolve(this.update(id, { status: "COMPLETED", completedAt: at }));
	}
	private update(id: string, change: Partial<AccountErasureRecord>): AccountErasureRecord {
		const existing = this.rows.get(id);
		if (existing === undefined) {
			throw new Error("missing");
		}
		const row = {
			...existing,
			...change,
		};
		this.rows.set(id, row);
		return row;
	}
}

interface Harness {
	readonly service: AccountErasureService;
	readonly store: InMemoryErasures;
	readonly steps: string[];
	readonly clock: { now: Clock["now"]; set: (at: number) => void };
	readonly blocked: Set<string>;
}

function harness(failingEraser = false): Harness {
	const store = new InMemoryErasures();
	const steps: string[] = [];
	const blocked = new Set<string>();
	const emails = new Map([
		["alice", "alice@example.com"],
		["bob", "bob@example.com"],
	]);
	let current = NOW;
	const clock = {
		now: (): ReturnType<Clock["now"]> => epochMs(current),
		set: (at: number): void => {
			current = at;
		},
	};
	const gateway: ErasureAccountGateway = {
		confirmPassword: (_userId, password) => Promise.resolve(password === PASSWORD),
		emailOf: (userId) => Promise.resolve(emails.get(userId) ?? null),
		endSessions: (userId) => {
			steps.push(`end-sessions:${userId}`);
			return Promise.resolve();
		},
		tombstone: (userId) => {
			steps.push(`tombstone:${userId}`);
			emails.delete(userId);
			return Promise.resolve();
		},
	};
	const registry = new PersonalDataErasureRegistry();
	registry.provideAccountGateway(gateway);
	registry.registerEraser({
		section: "notifications",
		erase: ({ userId }) => (failingEraser ? Promise.reject(new Error("db down")) : (steps.push(`erase:notifications:${userId}`), Promise.resolve(3))),
	});
	registry.registerBlocker({ name: "ownership", blockers: (userId) => Promise.resolve(blocked.has(userId) ? ["You own a business."] : []) });
	let id = 0;
	const service = new AccountErasureService({ store, registry, clock, ids: { next: (): string => `erasure-${String((id += 1))}` } });
	return { service, store, steps, clock, blocked };
}

describe("AccountErasureService: asking", () => {
	it("needs the right password, then starts the 30-day grace and ends every session; asking again returns the same request", async () => {
		const { service, store, steps } = harness();
		await expect(service.requestOwn(person("alice"), "wrong")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
		expect(store.rows.size).toBe(0);

		const request = await service.requestOwn(person("alice"), PASSWORD);
		expect(request).toMatchObject({ status: "PENDING", requestedBy: "self", reason: null, scheduledFor: NOW + ACCOUNT_ERASURE_GRACE_MS });
		expect(steps).toStrictEqual(["end-sessions:alice"]);
		await expect(service.requestOwn(person("alice"), PASSWORD)).resolves.toMatchObject({ id: request.id });
		expect(store.rows.size).toBe(1);
	});

	it("refuses while something blocks it, naming what, and changes nothing", async () => {
		const { service, store, steps, blocked } = harness();
		blocked.add("alice");
		await expect(service.requestOwn(person("alice"), PASSWORD)).rejects.toMatchObject({ details: { reason: "ACCOUNT_ERASURE_BLOCKED", blockers: ["You own a business."] } });
		expect(store.rows.size).toBe(0);
		expect(steps).toStrictEqual([]);
	});

	it("lets support ask for someone else with a reason, never for themselves, and never while impersonating", async () => {
		const { service } = harness();
		await expect(service.requestBySupport(person("support"), "bob", "Asked by email on 2 Nov")).resolves.toMatchObject({
			requestedBy: "support",
			reason: "Asked by email on 2 Nov",
		});
		await expect(service.requestBySupport(person("bob"), "bob", "self")).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(service.requestOwn(person("alice", "support"), PASSWORD)).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("cancels an open request, and says when there is none", async () => {
		const { service } = harness();
		await expect(service.cancelOwn(person("alice"))).rejects.toMatchObject({ code: "NOT_FOUND" });
		await service.requestOwn(person("alice"), PASSWORD);
		await expect(service.cancelOwn(person("alice"))).resolves.toMatchObject({ status: "CANCELLED", cancelledAt: NOW });
		await expect(service.ownStatus(person("alice"))).resolves.toMatchObject({ status: "CANCELLED" });
	});
});

describe("AccountErasureService: carrying out", () => {
	it("waits out the grace, then masks, erases, tombstones and completes, in that order", async () => {
		const { service, store, steps, clock } = harness();
		const request = await service.requestOwn(person("alice"), PASSWORD);
		await expect(service.completeDue(CRON)).resolves.toStrictEqual({ completed: 0, failed: 0, blocked: 0 });

		clock.set(NOW + ACCOUNT_ERASURE_GRACE_MS);
		steps.length = 0;
		await expect(service.completeDue(CRON)).resolves.toStrictEqual({ completed: 1, failed: 0, blocked: 0 });
		expect(store.masked).toStrictEqual(["alice"]);
		expect(steps).toStrictEqual(["erase:notifications:alice", "tombstone:alice"]);
		expect(store.rows.get(request.id)?.status).toBe("COMPLETED");
	});

	it("leaves a request that something now blocks waiting, and counts a failure without completing it", async () => {
		const blockedRun = harness();
		await blockedRun.service.requestOwn(person("alice"), PASSWORD);
		blockedRun.blocked.add("alice");
		blockedRun.clock.set(NOW + ACCOUNT_ERASURE_GRACE_MS);
		await expect(blockedRun.service.completeDue(CRON)).resolves.toStrictEqual({ completed: 0, failed: 0, blocked: 1 });

		const failingRun = harness(true);
		const request = await failingRun.service.requestOwn(person("bob"), PASSWORD);
		failingRun.clock.set(NOW + ACCOUNT_ERASURE_GRACE_MS);
		await expect(failingRun.service.completeDue(CRON)).resolves.toStrictEqual({ completed: 0, failed: 1, blocked: 0 });
		expect(failingRun.store.rows.get(request.id)?.status).toBe("PENDING");
	});
});
