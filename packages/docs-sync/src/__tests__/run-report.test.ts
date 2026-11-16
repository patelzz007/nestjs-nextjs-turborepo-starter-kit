import { epochMs, type DocsSyncRunReport } from "@workspace/shared";
import { describe, expect, it, vi } from "vitest";

import type { HttpFetch } from "../locked-download.ts";
import { RunReportRefusedError, sendRunReport, withPublicationFacts } from "../run-report.ts";

const REPORT: DocsSyncRunReport = {
	runId: "run-1",
	source: "NOTION",
	trigger: "SCHEDULE",
	status: "SUCCEEDED",
	converterVersion: 1,
	pagesProcessed: 1,
	pagesUnchanged: 0,
	pagesRemoved: 0,
	pagesHeldBack: 0,
	warnings: 0,
	heldBack: [],
	errorSummary: null,
	pullRequestUrl: null,
	commitSha: null,
	startedAt: epochMs(1),
	finishedAt: epochMs(2),
};

describe("sendRunReport", () => {
	it("posts the report with the bearer token", async () => {
		const fetch = vi.fn<HttpFetch>().mockResolvedValue(new Response("{}", { status: 200 }));

		await sendRunReport(REPORT, { apiUrl: "https://api.example", token: "secret", fetch });

		const [url, init] = fetch.mock.calls.at(0) ?? [];
		expect(String(url)).toBe("https://api.example/api/v1/docs-publishing/sync-runs");
		expect(init?.headers).toMatchObject({ Authorization: "Bearer secret" });
	});

	it("raises a refusal without the token in its message", async () => {
		const fetch = vi.fn<HttpFetch>().mockResolvedValue(new Response("no", { status: 401 }));

		const failure = sendRunReport(REPORT, { apiUrl: "https://api.example", token: "secret", fetch });

		await expect(failure).rejects.toBeInstanceOf(RunReportRefusedError);
		await expect(failure).rejects.not.toThrow("secret");
	});
});

describe("withPublicationFacts", () => {
	it("adds what is known once the pull request exists", () => {
		expect(withPublicationFacts(REPORT, { pullRequestUrl: "https://github.com/o/r/pull/1", commitSha: "abc" })).toMatchObject({
			pullRequestUrl: "https://github.com/o/r/pull/1",
			commitSha: "abc",
		});
	});
});
