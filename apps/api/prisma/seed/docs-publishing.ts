import type { DocsSourceKind, DocsSyncRunStatus, DocsSyncTrigger, Prisma } from "@prisma/client";
import type { DocsSyncHeldBackPage } from "@workspace/shared";

import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";

// ---------------------------------------------------------------------------
// Docs sync runs (ADR 084) — development scenario.
//
// One run of each outcome and each trigger, so the Operations console's Docs sync page shows a clean run, one that
// changed nothing, a held-back page with block-level reasons, a blocked batch and a failure, without a Notion
// workspace. The Notion addresses are the reserved `.invalid` kind in spirit: example ids that reach no real page.
// Idempotent: upserted by id.
// ---------------------------------------------------------------------------

const NAMESPACE = "seed.docs-publishing";
const MINUTE_MS = 60_000;
/** How long a seeded sync took. */
const RUN_DURATION_MS = 42_000;
const CONVERTER_VERSION = 1;
const SEED_ACTOR = "system:docs_publishing.record";
const EXAMPLE_PULL_REQUEST_URL = "https://github.com/example/starter-kit/pull/412";
const EXAMPLE_COMMIT_SHA = "9f2c4e1ab7d05c3e8a61f4b2d7c90e13a5b8f604";

const HELD_BACK_PAGE: DocsSyncHeldBackPage = {
	sourceId: "0194f3a0-5d00-7a01-8c00-000000000101",
	title: "Rewards walkthrough",
	slug: "user-guide/04-rewards",
	sourceUrl: "https://www.notion.so/0194f3a05d007a018c00000000000101",
	issues: [
		{
			blockId: "0194f3a0-5d00-7a01-8c00-000000000201",
			blockType: "column_list",
			reason: "A column list block cannot be published yet.",
			fix: "Stack the columns one after another.",
		},
		{ blockId: null, blockType: null, reason: "The page has no description.", fix: "Fill in the Description property; search and sharing show it." },
	],
};

interface SeedRun {
	readonly key: string;
	readonly trigger: DocsSyncTrigger;
	readonly status: DocsSyncRunStatus;
	readonly minutesAgo: number;
	readonly processed: number;
	readonly unchanged: number;
	readonly removed: number;
	readonly warnings: number;
	readonly heldBack: readonly DocsSyncHeldBackPage[];
	readonly errorSummary: string | null;
	readonly published: boolean;
}

const RUNS: readonly SeedRun[] = [
	{
		key: "webhook-edit",
		trigger: "WEBHOOK",
		status: "SUCCEEDED",
		minutesAgo: 9,
		processed: 1,
		unchanged: 185,
		removed: 0,
		warnings: 0,
		heldBack: [],
		errorSummary: null,
		published: true,
	},
	{
		key: "schedule-quiet",
		trigger: "SCHEDULE",
		status: "SUCCEEDED",
		minutesAgo: 24,
		processed: 0,
		unchanged: 186,
		removed: 0,
		warnings: 0,
		heldBack: [],
		errorSummary: null,
		published: false,
	},
	{
		key: "held-back",
		trigger: "WEBHOOK",
		status: "PARTIAL",
		minutesAgo: 70,
		processed: 2,
		unchanged: 183,
		removed: 0,
		warnings: 1,
		heldBack: [HELD_BACK_PAGE],
		errorSummary: null,
		published: true,
	},
	{
		key: "duplicate-slug",
		trigger: "MANUAL",
		status: "BLOCKED",
		minutesAgo: 190,
		processed: 0,
		unchanged: 0,
		removed: 0,
		warnings: 0,
		heldBack: [],
		errorSummary: 'The slug "technical/database" is used by both 0194f3a0-5d00-7a01-8c00-000000000102 and 0194f3a0-5d00-7a01-8c00-000000000103.',
		published: false,
	},
	{
		key: "notion-down",
		trigger: "SCHEDULE",
		status: "FAILED",
		minutesAgo: 400,
		processed: 0,
		unchanged: 0,
		removed: 0,
		warnings: 0,
		heldBack: [],
		errorSummary: "Could not list the published documents: Notion answered 503: service_unavailable",
		published: false,
	},
	{
		key: "nightly-full",
		trigger: "NIGHTLY",
		status: "SUCCEEDED",
		minutesAgo: 720,
		processed: 186,
		unchanged: 0,
		removed: 1,
		warnings: 3,
		heldBack: [],
		errorSummary: null,
		published: true,
	},
];

const SOURCE: DocsSourceKind = "NOTION";

export async function seedDocsPublishing(now: number): Promise<number> {
	for (const run of RUNS) {
		const id = deterministicUuid(NAMESPACE, `run:${run.key}`);
		const startedAt = now - run.minutesAgo * MINUTE_MS;
		const finishedAt = startedAt + RUN_DURATION_MS;
		const row: Omit<Prisma.DocsSyncRunCreateInput, "id"> = {
			runId: id,
			source: SOURCE,
			trigger: run.trigger,
			status: run.status,
			converterVersion: CONVERTER_VERSION,
			pagesProcessed: run.processed,
			pagesUnchanged: run.unchanged,
			pagesRemoved: run.removed,
			pagesHeldBack: run.heldBack.length,
			warnings: run.warnings,
			heldBack: [...run.heldBack],
			errorSummary: run.errorSummary,
			pullRequestUrl: run.published ? EXAMPLE_PULL_REQUEST_URL : null,
			commitSha: run.published ? EXAMPLE_COMMIT_SHA : null,
			startedAt: BigInt(startedAt),
			finishedAt: BigInt(finishedAt),
			createdAt: BigInt(finishedAt),
			createdBy: SEED_ACTOR,
			updatedAt: BigInt(finishedAt),
			updatedBy: SEED_ACTOR,
		};
		await prisma.docsSyncRun.upsert({ where: { id }, create: { id, ...row }, update: row });
	}
	return RUNS.length;
}
