// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { RewardCard } from "@/components/rewardhub/browse/card";
import { buildRewardResponse } from "@/test-support/reward";

const LOGO_URL = "https://cdn.example.com/organizations/brew-bean/logo.png";

afterEach((): void => {
	cleanup();
});

function merchantMark(container: HTMLElement): Element | null {
	return container.querySelector("[data-slot=entity-avatar]");
}

describe("RewardCard merchant identity", () => {
	it("shows the merchant's logo next to the shop name", () => {
		const { container } = render(<RewardCard reward={buildRewardResponse({ organizationLogoUrl: LOGO_URL })} />);

		expect(screen.getByText("Brew & Bean KL")).toBeDefined();
		expect(merchantMark(container)?.querySelector("img")?.getAttribute("src")).toBe(LOGO_URL);
	});

	it("shows a monogram of the shop name when the merchant has no logo", () => {
		const { container } = render(<RewardCard reward={buildRewardResponse({ organizationLogoUrl: null })} />);

		expect(screen.getByText("BK")).toBeDefined();
		expect(merchantMark(container)?.querySelector("img")).toBeNull();
	});

	it("keeps the mark decorative because the shop name is rendered as text beside it", () => {
		const { container } = render(<RewardCard reward={buildRewardResponse({ organizationLogoUrl: LOGO_URL })} />);

		expect(merchantMark(container)?.getAttribute("aria-hidden")).toBe("true");
		expect(screen.getAllByText("Brew & Bean KL")).toHaveLength(1);
	});

	it("falls back to the category glyph when the reward carries no merchant", () => {
		const { organizationName, ...anonymousReward } = buildRewardResponse();
		const { container } = render(<RewardCard reward={anonymousReward} />);

		expect(merchantMark(container)).toBeNull();
		expect(screen.queryByText("BK")).toBeNull();
	});
});
