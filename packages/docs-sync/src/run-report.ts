import { apiPath, DOCS_SYNC_REPORT_PATH, type DocsSyncRunReport } from "@workspace/shared";

import type { HttpFetch } from "./locked-download.ts";

/** Tells the platform how a run went, so the Operations console shows it (ADR 084). */

export interface ReportTarget {
	/** The API's origin, without a path. */
	readonly apiUrl: string;
	readonly token: string;
	readonly fetch: HttpFetch;
}

const REPORT_TIMEOUT_MS = 15_000;

/** The API refused a report. The sync itself already finished, so the caller decides what this means. */
export class RunReportRefusedError extends Error {
	public constructor(status: number) {
		super(`The API refused the sync report with ${String(status)}`);
		this.name = "RunReportRefusedError";
	}
}

/** A report with what is only known once the pull request exists. */
export function withPublicationFacts(report: DocsSyncRunReport, facts: Pick<DocsSyncRunReport, "pullRequestUrl" | "commitSha">): DocsSyncRunReport {
	return { ...report, ...facts };
}

export async function sendRunReport(report: DocsSyncRunReport, target: ReportTarget): Promise<void> {
	const response = await target.fetch(new URL(apiPath(DOCS_SYNC_REPORT_PATH), target.apiUrl), {
		method: "POST",
		headers: { Authorization: `Bearer ${target.token}`, "Content-Type": "application/json" },
		body: JSON.stringify(report),
		signal: AbortSignal.timeout(REPORT_TIMEOUT_MS),
	});
	if (!response.ok) {
		throw new RunReportRefusedError(response.status);
	}
}
