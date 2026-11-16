import { epochMs, type DocsSourceKind, type DocsSyncRunReport, type DocsSyncRunStatus, type DocsWebhookHandshake } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { systemActor } from "../../../../platform/application/actor-context";
import { FixedClock } from "../../../../platform/application/__tests__/fixed-clock";
import { AppError } from "../../../../platform/application/errors/app-error";
import type { OperationalAlert, OperationalAlertPort } from "../../../../platform/application/ports/operational-alert.port";
import {
	inboundWebhookRequest,
	type InboundWebhookHandling,
	type InboundWebhookReceiverPort,
	type ReceiveWebhookInput,
	type WebhookReception,
} from "../../../webhooks/inbound/public-api";
import { PruneDocsSyncRunsCommand } from "../commands/prune-docs-sync-runs/prune-docs-sync-runs.command";
import { PruneDocsSyncRunsHandler } from "../commands/prune-docs-sync-runs/prune-docs-sync-runs.handler";
import { ReceiveNotionWebhookCommand, type NotionWebhookOutcome } from "../commands/receive-notion-webhook/receive-notion-webhook.command";
import { ReceiveNotionWebhookHandler } from "../commands/receive-notion-webhook/receive-notion-webhook.handler";
import { RecordDocsSyncRunCommand } from "../commands/record-docs-sync-run/record-docs-sync-run.command";
import { RecordDocsSyncRunHandler } from "../commands/record-docs-sync-run/record-docs-sync-run.handler";
import { RevealDocsWebhookHandshakeHandler } from "../commands/reveal-docs-webhook-handshake/reveal-docs-webhook-handshake.handler";
import { StartDocsSyncCommand } from "../commands/start-docs-sync/start-docs-sync.command";
import { StartDocsSyncHandler } from "../commands/start-docs-sync/start-docs-sync.handler";
import type {
	DocsPublishingSettings,
	DocsSyncDispatch,
	DocsSyncDispatcherPort,
	DocsSyncRunStorePort,
	DocsWebhookHandshakeStorePort,
	RecordedRun,
} from "../ports/docs-publishing.ports";

const NOW = epochMs(1_800_000_000_000);
const REPORT_TOKEN = "a".repeat(32);
const ACTOR = systemActor("docs_publishing.record", "cron", null, "test", null);

/** The port's behaviour without its encryption and expiry, which the adapters' own spec covers. */
class FakeHandshakeStore implements DocsWebhookHandshakeStorePort {
	private readonly tokens = new Map<DocsSourceKind, string>();

	public put(source: DocsSourceKind, verificationToken: string): Promise<void> {
		this.tokens.set(source, verificationToken);
		return Promise.resolve();
	}

	public find(source: DocsSourceKind): Promise<DocsWebhookHandshake | null> {
		const verificationToken = this.tokens.get(source);
		return Promise.resolve(verificationToken === undefined ? null : { source, verificationToken, receivedAt: NOW });
	}
}

function config(settings: Partial<DocsPublishingSettings> = {}): DocsPublishingSettings {
	return { notionWebhookSecret: "secret", reportToken: REPORT_TOKEN, retentionDays: 90, ...settings };
}

class RecordingAlerts implements OperationalAlertPort {
	public readonly raised: OperationalAlert[] = [];

	public raise(alert: OperationalAlert): void {
		this.raised.push(alert);
	}
}

class RecordingDispatcher implements DocsSyncDispatcherPort {
	public readonly dispatched: DocsSyncDispatch[] = [];
	public failure: Error | null = null;

	public dispatch(request: DocsSyncDispatch): Promise<void> {
		if (this.failure !== null) {
			return Promise.reject(this.failure);
		}
		this.dispatched.push(request);
		return Promise.resolve();
	}
}

/** The real receiver's contract, reduced to the turns these tests take: verified, then handed over. */
class PassThroughReceiver implements InboundWebhookReceiverPort {
	public eventType: string | null = "page.content_updated";
	public duplicate = false;
	public lastInput: ReceiveWebhookInput<NotionWebhookOutcome> | null = null;

	public async receive<TResult>(input: ReceiveWebhookInput<TResult>): Promise<WebhookReception<TResult>> {
		if (input.verifier === null) {
			throw input.notConfigured();
		}
		if (this.duplicate) {
			return { kind: "duplicate" };
		}
		const handling: InboundWebhookHandling<TResult> = await input.handle({ deliveryId: "event-1", eventType: this.eventType });
		return { kind: "handled", ...handling };
	}
}

function report(overrides: Partial<DocsSyncRunReport> = {}): DocsSyncRunReport {
	return {
		runId: "run-1",
		source: "NOTION",
		trigger: "SCHEDULE",
		status: "SUCCEEDED",
		converterVersion: 1,
		pagesProcessed: 0,
		pagesUnchanged: 1,
		pagesRemoved: 0,
		pagesHeldBack: 0,
		warnings: 0,
		heldBack: [],
		errorSummary: null,
		pullRequestUrl: null,
		commitSha: null,
		startedAt: epochMs(1),
		finishedAt: epochMs(2),
		...overrides,
	};
}

describe("ReceiveNotionWebhookHandler", () => {
	let receiver: PassThroughReceiver;
	let dispatcher: RecordingDispatcher;
	let alerts: RecordingAlerts;
	let handshakes: FakeHandshakeStore;

	beforeEach(() => {
		receiver = new PassThroughReceiver();
		dispatcher = new RecordingDispatcher();
		alerts = new RecordingAlerts();
		handshakes = new FakeHandshakeStore();
	});

	function handler(secret: string | null = "secret", usedDispatcher: DocsSyncDispatcherPort | null = dispatcher): ReceiveNotionWebhookHandler {
		return new ReceiveNotionWebhookHandler(config({ notionWebhookSecret: secret }), receiver, handshakes, usedDispatcher, alerts);
	}

	const event = new ReceiveNotionWebhookCommand(
		ACTOR,
		inboundWebhookRequest(Buffer.from('{"id":"event-1","type":"page.content_updated"}'), { "x-notion-signature": "sha256=abc" }),
	);
	const handshake = new ReceiveNotionWebhookCommand(ACTOR, inboundWebhookRequest(Buffer.from('{"verification_token":"secret_abc"}'), {}));

	it("keeps the handshake token for an operator while no secret is set", async () => {
		await expect(handler(null).execute(handshake)).resolves.toBe("handshake");

		await expect(handshakes.find("NOTION")).resolves.toMatchObject({ verificationToken: "secret_abc" });
	});

	it("keeps the token of a handshake Notion also signed, as the live service does", async () => {
		const signedHandshake = new ReceiveNotionWebhookCommand(
			ACTOR,
			inboundWebhookRequest(Buffer.from('{"verification_token":"secret_abc"}'), { "x-notion-signature": "sha256=abc" }),
		);

		await expect(handler(null).execute(signedHandshake)).resolves.toBe("handshake");
		await expect(handshakes.find("NOTION")).resolves.toMatchObject({ verificationToken: "secret_abc" });
	});

	it("refuses a handshake once a secret is set: an unsigned request can no longer change anything", async () => {
		const result = await handler("secret").execute(handshake);

		expect(result).toBe("dispatched");
		await expect(handshakes.find("NOTION")).resolves.toBeNull();
	});

	it("answers 503 for an event before a secret is set, so Notion retries", async () => {
		await expect(handler(null).execute(event)).rejects.toMatchObject({ httpStatus: 503 });
	});

	it("starts a sync with fixed values, passing nothing from the request", async () => {
		await expect(handler().execute(event)).resolves.toBe("dispatched");

		expect(dispatcher.dispatched).toEqual([{ trigger: "WEBHOOK", full: false }]);
	});

	it("ignores an event that cannot change a page", async () => {
		receiver.eventType = "comment.created";

		await expect(handler().execute(event)).resolves.toBe("ignored");
		expect(dispatcher.dispatched).toEqual([]);
	});

	it("ignores a change when this server cannot start a sync: the schedule picks it up", async () => {
		await expect(handler("secret", null).execute(event)).resolves.toBe("ignored");
	});

	it("does nothing for a redelivery", async () => {
		receiver.duplicate = true;

		await expect(handler().execute(event)).resolves.toBe("duplicate");
		expect(dispatcher.dispatched).toEqual([]);
	});

	it("alerts and answers an error when GitHub refuses, so Notion retries", async () => {
		dispatcher.failure = new Error("GitHub answered 500");

		await expect(handler().execute(event)).rejects.toBeInstanceOf(AppError);
		expect(alerts.raised.map((alert) => alert.event)).toEqual(["docs_publishing.dispatch_failed"]);
	});
});

describe("RecordDocsSyncRunHandler", () => {
	function setup(
		recorded: RecordedRun,
		settings: Partial<DocsPublishingSettings> = {},
	): { readonly handler: RecordDocsSyncRunHandler; readonly alerts: RecordingAlerts; readonly record: ReturnType<typeof vi.fn> } {
		const record = vi.fn<DocsSyncRunStorePort["record"]>().mockResolvedValue(recorded);
		const alerts = new RecordingAlerts();
		const store: DocsSyncRunStorePort = { record, prune: () => Promise.resolve(0) };
		return { handler: new RecordDocsSyncRunHandler(config(settings), store, alerts), alerts, record };
	}

	it("records a report that presents the token", async () => {
		const { handler, record } = setup({ isNew: true, previousStatus: "SUCCEEDED" });

		await expect(handler.execute(new RecordDocsSyncRunCommand(REPORT_TOKEN, report()))).resolves.toEqual({ recorded: true });
		expect(record).toHaveBeenCalledOnce();
	});

	it.each([null, "wrong", ""])("refuses the token %j, recording nothing", async (token) => {
		const { handler, record } = setup({ isNew: true, previousStatus: null });

		await expect(handler.execute(new RecordDocsSyncRunCommand(token, report()))).rejects.toMatchObject({ httpStatus: 401 });
		expect(record).not.toHaveBeenCalled();
	});

	it("answers 503 when this server takes no reports", async () => {
		const { handler } = setup({ isNew: true, previousStatus: null }, { reportToken: null });

		await expect(handler.execute(new RecordDocsSyncRunCommand(REPORT_TOKEN, report()))).rejects.toMatchObject({ httpStatus: 503 });
	});

	const troubled: readonly DocsSyncRunStatus[] = ["PARTIAL", "BLOCKED", "FAILED"];

	it.each(troubled)("alerts when a good state turns %s", async (status) => {
		const { handler, alerts } = setup({ isNew: true, previousStatus: "SUCCEEDED" });

		await handler.execute(new RecordDocsSyncRunCommand(REPORT_TOKEN, report({ status })));

		expect(alerts.raised.map((alert) => alert.event)).toEqual(["docs_publishing.sync_needs_attention"]);
	});

	it("alerts on a very first run that needs attention", async () => {
		const { handler, alerts } = setup({ isNew: true, previousStatus: null });

		await handler.execute(new RecordDocsSyncRunCommand(REPORT_TOKEN, report({ status: "FAILED" })));

		expect(alerts.raised).toHaveLength(1);
	});

	it("raises one alert for a repeated failure, not one per run", async () => {
		const { handler, alerts } = setup({ isNew: true, previousStatus: "FAILED" });

		await handler.execute(new RecordDocsSyncRunCommand(REPORT_TOKEN, report({ status: "FAILED" })));

		expect(alerts.raised).toEqual([]);
	});

	it("does not alert again when the same run reports its pull request", async () => {
		const { handler, alerts } = setup({ isNew: false, previousStatus: "SUCCEEDED" });

		await handler.execute(new RecordDocsSyncRunCommand(REPORT_TOKEN, report({ status: "PARTIAL" })));

		expect(alerts.raised).toEqual([]);
	});

	it("stays quiet for a good run", async () => {
		const { handler, alerts } = setup({ isNew: true, previousStatus: "FAILED" });

		await handler.execute(new RecordDocsSyncRunCommand(REPORT_TOKEN, report()));

		expect(alerts.raised).toEqual([]);
	});
});

describe("StartDocsSyncHandler", () => {
	it("starts a sync", async () => {
		const dispatcher = new RecordingDispatcher();

		await expect(new StartDocsSyncHandler(dispatcher).execute(new StartDocsSyncCommand(ACTOR, { full: true }))).resolves.toEqual({ started: true });
		expect(dispatcher.dispatched).toEqual([{ trigger: "MANUAL", full: true }]);
	});

	it("says so when this server cannot start one", async () => {
		await expect(new StartDocsSyncHandler(null).execute(new StartDocsSyncCommand(ACTOR, { full: false }))).rejects.toMatchObject({ httpStatus: 503 });
	});

	it("answers 502 when GitHub refuses", async () => {
		const dispatcher = new RecordingDispatcher();
		dispatcher.failure = new Error("GitHub answered 404");

		await expect(new StartDocsSyncHandler(dispatcher).execute(new StartDocsSyncCommand(ACTOR, { full: false }))).rejects.toMatchObject({ httpStatus: 502 });
	});
});

describe("RevealDocsWebhookHandshakeHandler", () => {
	it("answers the waiting token", async () => {
		const store = new FakeHandshakeStore();
		await store.put("NOTION", "secret_abc");

		await expect(new RevealDocsWebhookHandshakeHandler(store).execute()).resolves.toMatchObject({ source: "NOTION", verificationToken: "secret_abc", receivedAt: NOW });
	});

	it("answers 404 when none is waiting", async () => {
		const store = new FakeHandshakeStore();

		await expect(new RevealDocsWebhookHandshakeHandler(store).execute()).rejects.toMatchObject({ httpStatus: 404 });
	});
});

describe("PruneDocsSyncRunsHandler", () => {
	it("prunes what is older than the retention", async () => {
		const prune = vi.fn<DocsSyncRunStorePort["prune"]>().mockResolvedValue(3);
		const store: DocsSyncRunStorePort = { record: () => Promise.resolve({ isNew: true, previousStatus: null }), prune };

		await expect(new PruneDocsSyncRunsHandler(config({ retentionDays: 10 }), store, new FixedClock(NOW)).execute(new PruneDocsSyncRunsCommand(ACTOR))).resolves.toBe(3);
		expect(prune).toHaveBeenCalledWith(NOW - 10 * 86_400_000);
	});
});
