import { z } from "zod";

import { EpochMsSchema } from "../../../schemas/api/common";
import { defineListQuery, listFilter } from "../../../schemas/api/list-query";

/**
 * Docs publishing: what the docs sync tells the platform, and what the admin console reads back
 * (ADR 084). One sync run turns the documents published in a writing tool into generated Markdown in the
 * repository. The tool is a source (`DocsSourceKindSchema`): Notion today, and the same run record for
 * any source added later.
 */

// ── Enums (mirror the Prisma enums) ─────────────────────────────────────────

/** The writing tool a run read from. Mirrors the Prisma enum `DocsSourceKind`; add a tool here and in `packages/docs-sync`. */
export const DocsSourceKindSchema = z.enum(["NOTION"]);
export type DocsSourceKind = z.output<typeof DocsSourceKindSchema>;

/** What started a run. Mirrors the Prisma enum `DocsSyncTrigger`. */
export const DocsSyncTriggerSchema = z.enum(["WEBHOOK", "SCHEDULE", "NIGHTLY", "MANUAL"]);
export type DocsSyncTrigger = z.output<typeof DocsSyncTriggerSchema>;

/**
 * What a run came to. Mirrors the Prisma enum `DocsSyncRunStatus`.
 * - `SUCCEEDED`: every page published, or nothing changed.
 * - `PARTIAL`: the good pages published; at least one was held back and kept its last good version.
 * - `BLOCKED`: a workspace-level problem (duplicate slug, unsafe path); nothing was written.
 * - `FAILED`: the run itself broke (the source could not be read).
 */
export const DocsSyncRunStatusSchema = z.enum(["SUCCEEDED", "PARTIAL", "BLOCKED", "FAILED"]);
export type DocsSyncRunStatus = z.output<typeof DocsSyncRunStatusSchema>;

// ── Budgets (mirror the column sizes in prisma/schema.prisma) ───────────────

export const DOCS_SYNC_RUN_ID_MAX_LENGTH = 64;
export const DOCS_SYNC_TEXT_MAX_LENGTH = 500;
export const DOCS_SYNC_URL_MAX_LENGTH = 2048;
/** Longest commit id kept: a full SHA-256 object name. */
export const DOCS_SYNC_COMMIT_MAX_LENGTH = 64;
/** The most held-back pages and problems one report may list; a bigger run still counts them all. */
export const DOCS_SYNC_HELD_BACK_MAX_ITEMS = 200;
export const DOCS_SYNC_ISSUES_PER_PAGE_MAX_ITEMS = 50;
/** A run id: letters, digits and hyphens, so it is safe in a path and a log line. */
export const DOCS_SYNC_RUN_ID_PATTERN = /^[a-zA-Z0-9-]+$/;

const SyncTextSchema = z.string().min(1).max(DOCS_SYNC_TEXT_MAX_LENGTH);
const CountSchema = z.number().int().nonnegative();

// ── What a run reports ──────────────────────────────────────────────────────

/** One thing stopping a page, in words a writer can act on. `blockId` and `blockType` are null for a page-level problem. */
export const DocsSyncIssueSchema = z.object({
	blockId: SyncTextSchema.nullable(),
	blockType: SyncTextSchema.nullable(),
	reason: SyncTextSchema,
	fix: SyncTextSchema,
});
export type DocsSyncIssue = z.output<typeof DocsSyncIssueSchema>;

/** A page that kept its last good version this run. */
export const DocsSyncHeldBackPageSchema = z.object({
	sourceId: SyncTextSchema,
	title: SyncTextSchema,
	slug: SyncTextSchema.nullable(),
	sourceUrl: z.url().max(DOCS_SYNC_URL_MAX_LENGTH).nullable(),
	issues: z.array(DocsSyncIssueSchema).min(1).max(DOCS_SYNC_ISSUES_PER_PAGE_MAX_ITEMS),
});
export type DocsSyncHeldBackPage = z.output<typeof DocsSyncHeldBackPageSchema>;

/** The fields of a run. Open, because the console's responses extend it: a response schema is never closed (ADR 022). */
const DocsSyncRunFieldsSchema = z.object({
	runId: z.string().min(1).max(DOCS_SYNC_RUN_ID_MAX_LENGTH).regex(DOCS_SYNC_RUN_ID_PATTERN),
	source: DocsSourceKindSchema,
	trigger: DocsSyncTriggerSchema,
	status: DocsSyncRunStatusSchema,
	converterVersion: CountSchema,
	pagesProcessed: CountSchema,
	pagesUnchanged: CountSchema,
	pagesRemoved: CountSchema,
	pagesHeldBack: CountSchema,
	warnings: CountSchema,
	heldBack: z.array(DocsSyncHeldBackPageSchema).max(DOCS_SYNC_HELD_BACK_MAX_ITEMS),
	/** Why the run was blocked or failed, one line; null when it finished. */
	errorSummary: SyncTextSchema.nullable(),
	pullRequestUrl: z.url().max(DOCS_SYNC_URL_MAX_LENGTH).nullable(),
	commitSha: z.string().min(1).max(DOCS_SYNC_COMMIT_MAX_LENGTH).nullable(),
	startedAt: EpochMsSchema,
	finishedAt: EpochMsSchema,
});

/**
 * `POST /docs-publishing/sync-runs`. Sent by the sync, once when it finishes and again once its pull request
 * exists: a repeat with the same `runId` replaces the row, so a retry is harmless.
 */
export const DocsSyncRunReportSchema = DocsSyncRunFieldsSchema.strict();
export type DocsSyncRunReport = z.output<typeof DocsSyncRunReportSchema>;

export const DocsSyncRunAckSchema = z.object({ recorded: z.literal(true) });
export type DocsSyncRunAck = z.output<typeof DocsSyncRunAckSchema>;

// ── What the console reads ──────────────────────────────────────────────────

/** One sync run in the list. */
export const DocsSyncRunSummarySchema = DocsSyncRunFieldsSchema.omit({ heldBack: true }).extend({ id: z.uuid() });
export type DocsSyncRunSummary = z.output<typeof DocsSyncRunSummarySchema>;

/** One sync run, complete. */
export const DocsSyncRunDetailSchema = DocsSyncRunFieldsSchema.extend({ id: z.uuid() });
export type DocsSyncRunDetail = z.output<typeof DocsSyncRunDetailSchema>;

/** What is set up on this server, and how the latest runs went. */
export const DocsSyncOverviewSchema = z.object({
	/** A signing secret is set, so webhooks can be verified. */
	webhookConfigured: z.boolean(),
	/** A GitHub credential is set, so this server can start a sync. */
	dispatchConfigured: z.boolean(),
	/** The sync can report here, so the runs below stay current. */
	reportingConfigured: z.boolean(),
	/** A verification token is waiting to be copied into the writing tool. */
	handshakePending: z.boolean(),
	latestRun: DocsSyncRunSummarySchema.nullable(),
	latestGoodRun: DocsSyncRunSummarySchema.nullable(),
});
export type DocsSyncOverview = z.output<typeof DocsSyncOverviewSchema>;

/** The webhook verification token, shown to an operator once they ask for it. */
export const DocsWebhookHandshakeSchema = z.object({
	source: DocsSourceKindSchema,
	verificationToken: z.string().min(1).max(DOCS_SYNC_TEXT_MAX_LENGTH),
	receivedAt: EpochMsSchema,
});
export type DocsWebhookHandshake = z.output<typeof DocsWebhookHandshakeSchema>;

export const DocsSyncStartedSchema = z.object({ started: z.literal(true) });
export type DocsSyncStarted = z.output<typeof DocsSyncStartedSchema>;

// ── Queries and commands ────────────────────────────────────────────────────

/** `POST /admin/docs-publishing/sync`: `full` rebuilds every page instead of only the changed ones. */
export const StartDocsSyncSchema = z.object({ full: z.boolean().default(false) }).strict();
export type StartDocsSync = z.output<typeof StartDocsSyncSchema>;

export const DocsSyncRunIdParamSchema = z.object({ id: z.uuid() }).strict();
export type DocsSyncRunIdParam = z.output<typeof DocsSyncRunIdParamSchema>;

/** `GET /admin/docs-publishing/runs` (newest first). */
export const docsSyncRunListQuery = defineListQuery({
	sortable: ["startedAt"],
	defaultSort: [{ field: "startedAt", direction: "desc" }],
	filter: {
		status: listFilter.enumeration(DocsSyncRunStatusSchema, { eq: true, in: true }),
		trigger: listFilter.enumeration(DocsSyncTriggerSchema, { eq: true, in: true }),
		source: listFilter.enumeration(DocsSourceKindSchema, { eq: true, in: true }),
	},
	params: {},
});
export const DocsSyncRunListQuerySchema = docsSyncRunListQuery.schema;
export type DocsSyncRunListQuery = z.output<typeof DocsSyncRunListQuerySchema>;
export type DocsSyncRunListSortField = (typeof docsSyncRunListQuery.sortable)[number];
