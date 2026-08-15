import { beforeEach, describe, expect, it } from "vitest";

import { TelescopeOptionsSchema, type TelescopeOptions } from "@workspace/shared";

import { ImpersonationEventsService } from "../impersonation/impersonation-events.service";

import { TelescopeEventBus } from "./telescope-event-bus";
import { TelescopeImpersonationJobAdapter } from "./telescope-impersonation-job-adapter";
import { TelescopeMemoryStore } from "./telescope.store";

describe("TelescopeImpersonationJobAdapter", () => {
	let store: TelescopeMemoryStore;
	let events: ImpersonationEventsService;
	let adapter: TelescopeImpersonationJobAdapter;

	beforeEach(() => {
		store = new TelescopeMemoryStore(100);
		const eventBus: TelescopeEventBus = new TelescopeEventBus();
		events = new ImpersonationEventsService();
		const options: TelescopeOptions = TelescopeOptionsSchema.parse({ enabled: true, sampling: { dev: 1, prod: 0.01 } });
		adapter = new TelescopeImpersonationJobAdapter(options, store, eventBus, events);
		adapter.onModuleInit();
	});

	afterEach(() => {
		adapter.onModuleDestroy();
	});

	it("records an impersonation start as an impersonation:start job", () => {
		events.emitAction({
			action: "start",
			superAdminId: "admin-1",
			targetUserId: "user-9",
			status: "succeeded",
			error: null,
			durationMs: 90,
		});
		const { items } = store.listJobs({ page: 1, pageSize: 10 });
		expect(items).toHaveLength(1);
		expect(items[0]?.jobName).toBe("impersonation:start");
		expect(items[0]?.status).toBe("succeeded");
		expect(items[0]?.durationMs).toBe(90);
	});

	it("records an impersonation stop with its own job name", () => {
		events.emitAction({
			action: "stop",
			superAdminId: "admin-1",
			targetUserId: "user-9",
			status: "succeeded",
			error: null,
			durationMs: 30,
		});
		const { items } = store.listJobs({ page: 1, pageSize: 10 });
		expect(items).toHaveLength(1);
		expect(items[0]?.jobName).toBe("impersonation:stop");
	});

	it("records a failed action as a failed job with the error", () => {
		events.emitAction({
			action: "start",
			superAdminId: "admin-1",
			targetUserId: "user-9",
			status: "failed",
			error: "TARGET_NOT_FOUND",
			durationMs: 20,
		});
		const { items } = store.listJobs({ page: 1, pageSize: 10 });
		expect(items[0]?.status).toBe("failed");
		expect(items[0]?.error).toBe("TARGET_NOT_FOUND");
	});
});
