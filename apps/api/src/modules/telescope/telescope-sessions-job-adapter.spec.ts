import { beforeEach, describe, expect, it } from "vitest";

import { TelescopeOptionsSchema, type TelescopeOptions } from "@workspace/shared";

import { SessionsEventsService } from "../sessions/sessions-events.service.js";

import { TelescopeEventBus } from "./telescope-event-bus.js";
import { TelescopeMemoryStore } from "./telescope.store.js";
import { TelescopeSessionsJobAdapter } from "./telescope-sessions-job-adapter.js";

describe("TelescopeSessionsJobAdapter", () => {
	let store: TelescopeMemoryStore;
	let events: SessionsEventsService;
	let adapter: TelescopeSessionsJobAdapter;

	beforeEach(() => {
		store = new TelescopeMemoryStore(100);
		const eventBus: TelescopeEventBus = new TelescopeEventBus();
		events = new SessionsEventsService();
		const options: TelescopeOptions = TelescopeOptionsSchema.parse({ enabled: true, sampling: { dev: 1, prod: 0.01 } });
		adapter = new TelescopeSessionsJobAdapter(options, store, eventBus, events);
		adapter.onModuleInit();
	});

	afterEach(() => {
		adapter.onModuleDestroy();
	});

	it("records a token refresh as a session:refresh job", () => {
		events.emitAction({ action: "refresh", userId: "user-1", status: "succeeded", error: null, durationMs: 55 });
		const { items } = store.listJobs({ page: 1, pageSize: 10 });
		expect(items).toHaveLength(1);
		expect(items[0]?.jobName).toBe("session:refresh");
		expect(items[0]?.status).toBe("succeeded");
		expect(items[0]?.durationMs).toBe(55);
	});

	it("throttles successive succeeded refreshes within the window", () => {
		events.emitAction({ action: "refresh", userId: "user-1", status: "succeeded", error: null, durationMs: 10 });
		events.emitAction({ action: "refresh", userId: "user-1", status: "succeeded", error: null, durationMs: 12 });
		events.emitAction({ action: "refresh", userId: "user-2", status: "succeeded", error: null, durationMs: 9 });
		expect(store.listJobs({ page: 1, pageSize: 10 }).items).toHaveLength(1);
	});

	it("never throttles a failed refresh (token reuse / theft detection)", () => {
		events.emitAction({ action: "refresh", userId: "user-1", status: "succeeded", error: null, durationMs: 10 });
		events.emitAction({ action: "refresh", userId: "user-1", status: "failed", error: "TOKEN_THEFT_DETECTED", durationMs: 30 });
		const { items } = store.listJobs({ page: 1, pageSize: 10 });
		expect(items).toHaveLength(2);
		expect(items[0]?.status).toBe("failed");
		expect(items[0]?.error).toBe("TOKEN_THEFT_DETECTED");
	});

	it("records logout actions without throttling", () => {
		events.emitAction({ action: "logout-device", userId: "user-1", status: "succeeded", error: null, durationMs: 20 });
		events.emitAction({ action: "logout-all", userId: "user-1", status: "succeeded", error: null, durationMs: 25 });
		const names: string[] = store.listJobs({ page: 1, pageSize: 10 }).items.map((job) => job.jobName);
		expect(names).toEqual(["session:logout-all", "session:logout-device"]);
	});
});
