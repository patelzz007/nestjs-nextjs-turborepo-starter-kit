// How a load test reads on every screen of the console (ADR 068): its result as a badge, and what it
// targets in words. Kept apart from the screens so the run page does not load the runs list.

import { LOAD_TEST_SCENARIOS, type LoadTestRun, type LoadTestStatus } from "@workspace/shared";
import type { StatusTone } from "@workspace/ui/components/status-badge";

export const LOAD_TEST_STATUS_PRESENTATION: Readonly<Record<LoadTestStatus, { readonly label: string; readonly tone: StatusTone }>> = {
	QUEUED: { label: "Queued", tone: "muted" },
	RUNNING: { label: "Running", tone: "info" },
	PASSED: { label: "Passed", tone: "success" },
	FAILED: { label: "Failed", tone: "danger" },
	ABORTED: { label: "Aborted", tone: "warning" },
	ERROR: { label: "Error", tone: "danger" },
};

/** What the run targets, in words. */
export function describeRunTarget(run: Pick<LoadTestRun, "target" | "scenario" | "endpoint">): string {
	if (run.target === "SCENARIO" && run.scenario !== null) {
		return LOAD_TEST_SCENARIOS[run.scenario].title;
	}
	return run.target === "ENDPOINT" ? `GET ${run.endpoint ?? ""}` : "Whole platform";
}
