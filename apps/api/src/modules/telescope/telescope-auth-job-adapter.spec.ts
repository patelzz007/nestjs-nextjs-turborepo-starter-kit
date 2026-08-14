import { beforeEach, describe, expect, it } from "vitest";

import { TelescopeOptionsSchema, type TelescopeOptions, type TelescopeSpan } from "@workspace/shared";

import { AuthEventsService, type AuthFlowEvent } from "../auth/services/auth-events.service.js";

import { RequestSpanContext, type SpanStore } from "./request-span-context.js";
import { TelescopeAuthJobAdapter } from "./telescope-auth-job-adapter.js";
import { TelescopeEventBus } from "./telescope-event-bus.js";
import { TelescopeMemoryStore } from "./telescope.store.js";

describe("TelescopeAuthJobAdapter", () => {
	let store: TelescopeMemoryStore;
	let events: AuthEventsService;
	let adapter: TelescopeAuthJobAdapter;

	beforeEach(() => {
		store = new TelescopeMemoryStore(100);
		const eventBus: TelescopeEventBus = new TelescopeEventBus();
		events = new AuthEventsService();
		const options: TelescopeOptions = TelescopeOptionsSchema.parse({ enabled: true, sampling: { dev: 1, prod: 0.01 } });
		adapter = new TelescopeAuthJobAdapter(options, store, eventBus, events);
		adapter.onModuleInit();
	});

	afterEach(() => {
		adapter.onModuleDestroy();
	});

	it("records a succeeded login as an auth:login job with duration", () => {
		events.emitFlow({
			flow: "login",
			userId: "user-1",
			clientType: "admin",
			status: "succeeded",
			error: null,
			durationMs: 120,
		});
		const { items } = store.listJobs({ page: 1, pageSize: 10 });
		expect(items).toHaveLength(1);
		expect(items[0]?.jobName).toBe("auth:login");
		expect(items[0]?.status).toBe("succeeded");
		expect(items[0]?.durationMs).toBe(120);
		expect(items[0]?.correlationId).toBeNull();
	});

	it("records a failed flow as a failed job with the error", () => {
		events.emitFlow({
			flow: "login",
			userId: "user-1",
			clientType: null,
			status: "failed",
			error: "INVALID_CREDENTIALS",
			durationMs: 40,
		});
		const { items } = store.listJobs({ page: 1, pageSize: 10 });
		expect(items).toHaveLength(1);
		expect(items[0]?.jobName).toBe("auth:login");
		expect(items[0]?.status).toBe("failed");
		expect(items[0]?.error).toBe("INVALID_CREDENTIALS");
	});

	it("maps every flow name to its own job name", () => {
		const flows: readonly AuthFlowEvent["flow"][] = ["signup", "forgot-password", "reset-password", "verify-email"];
		for (const flow of flows) {
			events.emitFlow({
				flow,
				userId: "user-1",
				clientType: null,
				status: "succeeded",
				error: null,
				durationMs: 10,
			});
		}
		const names: string[] = store.listJobs({ page: 1, pageSize: 10 }).items.map((job) => job.jobName);
		expect(names).toEqual(["auth:verify-email", "auth:reset-password", "auth:forgot-password", "auth:signup"]);
	});

	it("captures the correlation id and adds a queue span when the flow ran inside a captured request", () => {
		const spans: TelescopeSpan[] = [];
		const spanStore: SpanStore = {
			correlationId: "corr-auth",
			startedAt: performance.now(),
			spans,
			captured: true,
			userId: null,
			requestBody: null,
			logs: [],
			cacheOps: [],
		};
		RequestSpanContext.storage.run(spanStore, (): void => {
			events.emitFlow({
				flow: "signup",
				userId: "user-2",
				clientType: null,
				status: "succeeded",
				error: null,
				durationMs: 250,
			});
		});
		const { items } = store.listJobs({ page: 1, pageSize: 10 });
		expect(items[0]?.correlationId).toBe("corr-auth");
		expect(spans.some((span: TelescopeSpan): boolean => span.kind === "queue" && span.name === "job: auth:signup")).toBe(true);
	});
});
