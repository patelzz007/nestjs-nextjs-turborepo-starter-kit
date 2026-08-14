import { beforeEach, describe, expect, it } from "vitest";

import { TelescopeOptionsSchema, type TelescopeOptions, type TelescopeSpan } from "@workspace/shared";

import { EmailLogEventsService } from "../notifications/email/email-log-events.service.js";

import { RequestSpanContext, type SpanStore } from "./request-span-context.js";
import { TelescopeEmailJobAdapter } from "./telescope-email-job-adapter.js";
import { TelescopeEventBus } from "./telescope-event-bus.js";
import { TelescopeMemoryStore } from "./telescope.store.js";

describe("TelescopeEmailJobAdapter", () => {
	let store: TelescopeMemoryStore;
	let events: EmailLogEventsService;
	let adapter: TelescopeEmailJobAdapter;

	beforeEach(() => {
		store = new TelescopeMemoryStore(100);
		const eventBus: TelescopeEventBus = new TelescopeEventBus();
		events = new EmailLogEventsService();
		const options: TelescopeOptions = TelescopeOptionsSchema.parse({ enabled: true, sampling: { dev: 1, prod: 0.01 } });
		adapter = new TelescopeEmailJobAdapter(options, store, eventBus, events);
		adapter.onModuleInit();
	});

	afterEach(() => {
		adapter.onModuleDestroy();
	});

	it("records a real send as a succeeded job with name + duration", () => {
		events.emitUpdated({
			templateKey: "verification",
			status: "sent",
			to: "user@example.com",
			resendId: "re_123",
			error: null,
			durationMs: 240,
		});
		const { items } = store.listJobs({ page: 1, pageSize: 10 });
		expect(items).toHaveLength(1);
		expect(items[0]?.jobName).toBe("send-email:verification");
		expect(items[0]?.status).toBe("succeeded");
		expect(items[0]?.durationMs).toBe(240);
		expect(items[0]?.correlationId).toBeNull();
	});

	it("records a failed send as a failed job with the error", () => {
		events.emitUpdated({
			templateKey: "welcome",
			status: "failed",
			to: "user@example.com",
			resendId: null,
			error: "rate_limit_exceeded",
			durationMs: 0,
		});
		const { items } = store.listJobs({ page: 1, pageSize: 10 });
		expect(items).toHaveLength(1);
		expect(items[0]?.status).toBe("failed");
		expect(items[0]?.error).toBe("rate_limit_exceeded");
	});

	it("skips noop/log-only sends (sent without a resend id)", () => {
		events.emitUpdated({
			templateKey: "verification",
			status: "sent",
			to: "user@example.com",
			resendId: null,
			error: null,
			durationMs: null,
		});
		expect(store.listJobs({ page: 1, pageSize: 10 }).items).toHaveLength(0);
	});

	it("skips bare signals (webhook status flips carry no attempt payload)", () => {
		events.emitUpdated();
		expect(store.listJobs({ page: 1, pageSize: 10 }).items).toHaveLength(0);
	});

	it("captures the correlation id and adds a queue span when the send ran inside a captured request", () => {
		const spans: TelescopeSpan[] = [];
		const spanStore: SpanStore = {
			correlationId: "corr-123",
			startedAt: performance.now(),
			spans,
			captured: true,
			userId: null,
			requestBody: null,
			logs: [],
			cacheOps: [],
		};
		RequestSpanContext.storage.run(spanStore, (): void => {
			events.emitUpdated({
				templateKey: "security-alert",
				status: "sent",
				to: "user@example.com",
				resendId: "re_9",
				error: null,
				durationMs: 50,
			});
		});
		const { items } = store.listJobs({ page: 1, pageSize: 10 });
		expect(items[0]?.correlationId).toBe("corr-123");
		expect(spans.some((span: TelescopeSpan): boolean => span.kind === "queue" && span.name === "job: send-email:security-alert")).toBe(true);
	});
});
