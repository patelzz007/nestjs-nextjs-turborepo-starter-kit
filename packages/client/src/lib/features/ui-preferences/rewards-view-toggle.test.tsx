// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RewardsViewToggle, type RewardsViewToggleLabels } from "./rewards-view-toggle";
import type { RewardsViewMode } from "./state";

const LABELS: RewardsViewToggleLabels = { group: "Rewards layout", grid: "Grid view", list: "List view" };

afterEach((): void => {
	cleanup();
});

describe("RewardsViewToggle", () => {
	it("shows the current mode as pressed, named by the app's labels", () => {
		render(<RewardsViewToggle viewMode="list" onViewModeChange={vi.fn()} labels={LABELS} />);

		expect(screen.getByRole("group", { name: "Rewards layout" })).toBeDefined();
		expect(screen.getByRole("button", { name: "List view" }).getAttribute("aria-pressed")).toBe("true");
		expect(screen.getByRole("button", { name: "Grid view" }).getAttribute("aria-pressed")).toBe("false");
	});

	it("reports the chosen mode", () => {
		const onViewModeChange = vi.fn<(mode: RewardsViewMode) => void>();
		render(<RewardsViewToggle viewMode="grid" onViewModeChange={onViewModeChange} labels={LABELS} />);

		fireEvent.click(screen.getByRole("button", { name: "List view" }));

		expect(onViewModeChange).toHaveBeenCalledWith("list");
	});
});
