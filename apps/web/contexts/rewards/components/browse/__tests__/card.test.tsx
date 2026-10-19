// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { RewardCard } from "@/contexts/rewards/components/browse/card";
import { buildRewardResponse, FIXTURE_COVER_IMAGE_URL } from "@/test-support/reward";

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

function coverImage(container: HTMLElement): HTMLImageElement | null {
	return container.querySelector("[data-slot=cover-image] img");
}

describe("RewardCard cover", () => {
	it("leads the card with the reward's cover, decorative because the title sits below it", () => {
		const { container } = render(<RewardCard reward={buildRewardResponse()} />);

		expect(coverImage(container)?.getAttribute("src")).toBe(FIXTURE_COVER_IMAGE_URL);
		expect(coverImage(container)?.getAttribute("alt")).toBe("");
		expect(container.querySelector("article")?.firstElementChild?.querySelector("[data-slot=cover-image]")).not.toBeNull();
	});

	it("lazy-loads the cover unless the card is marked as the above-the-fold priority", () => {
		const { container } = render(<RewardCard reward={buildRewardResponse()} />);
		expect(coverImage(container)?.getAttribute("loading")).toBe("lazy");
		cleanup();

		const { container: priorityContainer } = render(<RewardCard reward={buildRewardResponse()} priority />);
		expect(coverImage(priorityContainer)?.getAttribute("loading")).toBe("eager");
	});

	it("keeps the merchant's mark beside the cover", () => {
		const { container } = render(<RewardCard reward={buildRewardResponse({ organizationLogoUrl: LOGO_URL })} />);

		expect(coverImage(container)).not.toBeNull();
		expect(merchantMark(container)?.querySelector("img")?.getAttribute("src")).toBe(LOGO_URL);
	});

	it("marks a sold-out offer on its cover", () => {
		render(<RewardCard reward={buildRewardResponse({ quantityRemaining: 0 })} />);

		expect(screen.getByText("Sold out")).toBeDefined();
		expect(screen.getByText("Unavailable")).toBeDefined();
	});
});

describe("RewardCard action", () => {
	it("labels the action with text alone — no trailing arrow icon", () => {
		render(<RewardCard reward={buildRewardResponse()} />);

		const action = screen.getByRole("link", { name: "View offer" });
		expect(action.textContent).toBe("View offer");
		expect(action.querySelector("svg")).toBeNull();
	});
});
