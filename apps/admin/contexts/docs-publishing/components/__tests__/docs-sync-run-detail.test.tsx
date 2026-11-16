// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { ClientTestProviders } from "@workspace/client/testing/client-test-providers";
import { DocsSyncRunDetailSchema, type DocsSyncRunDetail } from "@workspace/shared";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { DocsSyncRunRecord } from "../docs-sync-run-detail";

const RUN: DocsSyncRunDetail = DocsSyncRunDetailSchema.parse({
	id: "0193f3a8-3b1c-7c4e-9d2a-5b6c7d8e9f01",
	runId: "run-1",
	source: "NOTION",
	trigger: "WEBHOOK",
	status: "PARTIAL",
	converterVersion: 1,
	pagesProcessed: 2,
	pagesUnchanged: 183,
	pagesRemoved: 0,
	pagesHeldBack: 1,
	warnings: 1,
	heldBack: [
		{
			sourceId: "page-1",
			title: "Rewards walkthrough",
			slug: "user-guide/04-rewards",
			sourceUrl: "https://www.notion.so/page-1",
			issues: [{ blockId: "block-1", blockType: "column_list", reason: "A column list block cannot be published yet.", fix: "Stack the columns one after another." }],
		},
	],
	errorSummary: null,
	pullRequestUrl: "https://github.com/acme/kit/pull/1",
	commitSha: "abc123",
	startedAt: 1_790_000_000_000,
	finishedAt: 1_790_000_042_000,
});

function show(record: DocsSyncRunDetail): void {
	render(
		<ClientTestProviders>
			<DocsSyncRunRecord record={record} />
		</ClientTestProviders>,
	);
}

afterEach(cleanup);

describe("DocsSyncRunRecord", () => {
	it("names each held-back page, why, and what to change", () => {
		show(RUN);

		expect(screen.getByText("Rewards walkthrough")).toBeTruthy();
		expect(screen.getByText("A column list block cannot be published yet.")).toBeTruthy();
		expect(screen.getByText("Stack the columns one after another.")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Open the page" }).getAttribute("href")).toBe("https://www.notion.so/page-1");
	});

	it("traces the run to its pull request", () => {
		show(RUN);

		expect(screen.getByRole("link", { name: "Open on GitHub" }).getAttribute("href")).toBe("https://github.com/acme/kit/pull/1");
		expect(screen.getByText("42 s")).toBeTruthy();
	});

	it("says why a blocked run published nothing, and shows no empty held-back section", () => {
		show({ ...RUN, status: "BLOCKED", heldBack: [], pagesHeldBack: 0, errorSummary: 'The slug "a" is used by both x and y.' });

		expect(screen.getByText("Why nothing was published")).toBeTruthy();
		expect(screen.queryByText("Held-back pages")).toBeNull();
	});

	it("leaves out the page link for a tool with no web address", () => {
		const [page] = RUN.heldBack;
		if (page === undefined) {
			throw new Error("The fixture holds one page");
		}
		show({ ...RUN, heldBack: [{ ...page, sourceUrl: null, slug: null }] });

		expect(screen.queryByRole("link", { name: "Open the page" })).toBeNull();
		expect(screen.getByText("No slug yet")).toBeTruthy();
	});
});
