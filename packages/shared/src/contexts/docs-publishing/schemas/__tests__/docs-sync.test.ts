import { describe, expect, it } from "vitest";

import { epochMs } from "../../../../schemas/api/common";
import { DOCS_SYNC_HELD_BACK_MAX_ITEMS, DocsSyncRunReportSchema, StartDocsSyncSchema, type DocsSyncHeldBackPage, type DocsSyncRunReport } from "../docs-sync";

const HELD_BACK: DocsSyncHeldBackPage = {
	sourceId: "page-1",
	title: "Setup",
	slug: "setup",
	sourceUrl: "https://www.notion.so/page-1",
	issues: [{ blockId: "block-1", blockType: "column_list", reason: "Columns are not supported.", fix: "Stack the content instead." }],
};

const REPORT: DocsSyncRunReport = {
	runId: "run-1",
	source: "NOTION",
	trigger: "WEBHOOK",
	status: "PARTIAL",
	converterVersion: 1,
	pagesProcessed: 3,
	pagesUnchanged: 10,
	pagesRemoved: 0,
	pagesHeldBack: 1,
	warnings: 2,
	heldBack: [HELD_BACK],
	errorSummary: null,
	pullRequestUrl: null,
	commitSha: null,
	startedAt: epochMs(1),
	finishedAt: epochMs(2),
};

describe("DocsSyncRunReportSchema", () => {
	it("accepts a complete report", () => {
		expect(DocsSyncRunReportSchema.parse(REPORT)).toEqual(REPORT);
	});

	it("refuses a field it does not know", () => {
		expect(DocsSyncRunReportSchema.safeParse({ ...REPORT, token: "secret" }).success).toBe(false);
	});

	it("refuses a run id that could not be a run id", () => {
		expect(DocsSyncRunReportSchema.safeParse({ ...REPORT, runId: "../etc" }).success).toBe(false);
	});

	it("refuses more held-back pages than the budget", () => {
		const heldBack = Array.from({ length: DOCS_SYNC_HELD_BACK_MAX_ITEMS + 1 }, () => HELD_BACK);
		expect(DocsSyncRunReportSchema.safeParse({ ...REPORT, heldBack }).success).toBe(false);
	});

	it("refuses a held-back page with no reason", () => {
		expect(DocsSyncRunReportSchema.safeParse({ ...REPORT, heldBack: [{ ...HELD_BACK, issues: [] }] }).success).toBe(false);
	});
});

describe("StartDocsSyncSchema", () => {
	it("syncs only what changed unless asked for a full rebuild", () => {
		expect(StartDocsSyncSchema.parse({})).toEqual({ full: false });
		expect(StartDocsSyncSchema.parse({ full: true })).toEqual({ full: true });
	});
});
