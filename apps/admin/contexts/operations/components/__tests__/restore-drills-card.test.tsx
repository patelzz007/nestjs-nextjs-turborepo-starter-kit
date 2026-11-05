// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { epochMs, type OpsRestoreDrill } from "@workspace/shared";
import { accessibilityViolations } from "@workspace/ui/testing/axe";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { RestoreDrillsCard } from "../backups-view";

const PASSED: OpsRestoreDrill = {
	id: "d-1",
	backupId: "b-1",
	startedAt: epochMs(Date.UTC(2026, 10, 2, 3, 0)),
	finishedAt: epochMs(Date.UTC(2026, 10, 2, 3, 4)),
	outcome: "PASSED",
	tablesChecked: 120,
	rowsRestored: 48_210,
	failures: [],
	migration: "20261103083410_init",
};
const FAILED: OpsRestoreDrill = { ...PASSED, id: "d-0", outcome: "FAILED", failures: ["Row-level security isn't enabled and forced on: Tenant"] };

afterEach((): void => {
	cleanup();
});

describe("RestoreDrillsCard", () => {
	it("lists each drill with its outcome, what it checked and what failed", () => {
		render(<RestoreDrillsCard drills={[PASSED, FAILED]} configured />);
		const list = within(screen.getByRole("list", { name: "Restore drills" }));
		expect(list.getByText("Passed")).toBeTruthy();
		expect(list.getByText("Failed")).toBeTruthy();
		expect(list.getAllByText(/120 tables, 48,210 rows, migration 20261103083410_init/u)).toHaveLength(2);
		expect(list.getByText("Row-level security isn't enabled and forced on: Tenant")).toBeTruthy();
	});

	it("says when drills aren't set up, and when none has run yet", () => {
		const { unmount } = render(<RestoreDrillsCard drills={[]} configured={false} />);
		expect(screen.getByText(/RESTORE_DRILL_DATABASE_URL/u)).toBeTruthy();
		unmount();
		render(<RestoreDrillsCard drills={[]} configured />);
		expect(screen.getByText(/No drill has run yet/u)).toBeTruthy();
	});

	it("has no serious accessibility problems (enhancement 3.2)", async () => {
		render(<RestoreDrillsCard drills={[PASSED, FAILED]} configured />);
		await expect(accessibilityViolations(document.body)).resolves.toStrictEqual([]);
	});
});
