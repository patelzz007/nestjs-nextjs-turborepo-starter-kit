// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { RewardListRow } from "@/components/rewardhub/browse/list-row";
import { buildRewardResponse } from "@/test-support/reward";

const LOGO_URL = "https://cdn.example.com/organizations/brew-bean/logo.png";

afterEach((): void => {
	cleanup();
});

function merchantMark(container: HTMLElement): Element | null {
	return container.querySelector("[data-slot=entity-avatar]");
}

describe("RewardListRow merchant identity", () => {
	it("leads the row with the merchant's logo", () => {
		const { container } = render(<RewardListRow reward={buildRewardResponse({ organizationLogoUrl: LOGO_URL })} />);

		expect(merchantMark(container)?.querySelector("img")?.getAttribute("src")).toBe(LOGO_URL);
	});

	it("leads the row with a monogram when the merchant has no logo, and names the shop in the meta line", () => {
		const { container } = render(<RewardListRow reward={buildRewardResponse({ organizationLogoUrl: null })} />);

		expect(screen.getByText("BK")).toBeDefined();
		expect(merchantMark(container)?.getAttribute("aria-hidden")).toBe("true");
		expect(screen.getByText(/^Brew & Bean KL · Free item · Until /)).toBeDefined();
	});
});
