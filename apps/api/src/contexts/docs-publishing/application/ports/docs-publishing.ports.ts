import type {
	DocsSourceKind,
	DocsSyncRunDetail,
	DocsSyncRunListQuery,
	DocsSyncRunReport,
	DocsSyncRunStatus,
	DocsSyncRunSummary,
	DocsSyncTrigger,
	DocsWebhookHandshake,
	PaginatedServiceResult,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { SystemOperationName } from "../../../../platform/application/system-operation-names";

/** Recording a sync run and pruning old ones. */
export const DOCS_PUBLISHING_RECORD_OPERATION: SystemOperationName = "docs_publishing.record";
/** The console's reads, after the DOCS_SYNC check. */
export const DOCS_PUBLISHING_READ_OPERATION: SystemOperationName = "docs_publishing.read";

/** `DocsPublishingSettings`: this context's slice of the configuration. */
export const DOCS_PUBLISHING_SETTINGS = Symbol("DOCS_PUBLISHING_SETTINGS");
export const DOCS_SYNC_RUN_STORE = Symbol("DOCS_SYNC_RUN_STORE");
export const DOCS_SYNC_RUN_READ = Symbol("DOCS_SYNC_RUN_READ");
export const DOCS_SYNC_DISPATCHER = Symbol("DOCS_SYNC_DISPATCHER");
export const DOCS_WEBHOOK_HANDSHAKE_STORE = Symbol("DOCS_WEBHOOK_HANDSHAKE_STORE");

/** The settings the application layer reads. */
export interface DocsPublishingSettings {
	/** What Notion signs with; null until the webhook is verified. */
	readonly notionWebhookSecret: string | null;
	/** What the sync reports with; null = reports are refused. */
	readonly reportToken: string | null;
	readonly retentionDays: number;
}

/** What a report changed, so one failure raises one alert however many times it is reported. */
export interface RecordedRun {
	/** This is the first report of this run. */
	readonly isNew: boolean;
	/** How the run before this one ended; null for the very first run. */
	readonly previousStatus: DocsSyncRunStatus | null;
}

export interface DocsSyncRunStorePort {
	/** Replaces the row of `report.runId`, so a retried report is harmless. */
	record(report: DocsSyncRunReport): Promise<RecordedRun>;
	/** Deletes runs that started before `beforeMs`; answers how many. */
	prune(beforeMs: number): Promise<number>;
}

export interface DocsSyncRunReadPort {
	list(actor: ActorContext, query: DocsSyncRunListQuery): Promise<PaginatedServiceResult<DocsSyncRunSummary>>;
	findById(actor: ActorContext, id: string): Promise<DocsSyncRunDetail | null>;
	/** The newest run, and the newest that published everything. */
	latest(actor: ActorContext): Promise<{ readonly latestRun: DocsSyncRunSummary | null; readonly latestGoodRun: DocsSyncRunSummary | null }>;
}

/** What to start. Only these fixed values reach the workflow: nothing taken from a request. */
export interface DocsSyncDispatch {
	readonly trigger: DocsSyncTrigger;
	readonly full: boolean;
}

/** Starts the sync. Null in the module when this server has no credential. */
export interface DocsSyncDispatcherPort {
	dispatch(request: DocsSyncDispatch): Promise<void>;
}

/** The verification token a tool sent, held briefly until an operator copies it. */
export interface DocsWebhookHandshakeStorePort {
	put(source: DocsSourceKind, verificationToken: string): Promise<void>;
	find(source: DocsSourceKind): Promise<DocsWebhookHandshake | null>;
}
