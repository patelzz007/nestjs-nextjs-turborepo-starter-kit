// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LandingCallToAction } from "@/components/landing/landing-call-to-action";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingHowItWorks } from "@/components/landing/landing-how-it-works";
import { LandingMerchants } from "@/components/landing/landing-merchants";
import type { FeaturedOffer } from "@/lib/rewards/featured-offers";

/** The header's sign-in / profile control needs the auth providers — irrelevant to these layout tests. */
vi.mock("@/components/landing/landing-auth-actions", () => ({
	LandingAuthActions: (): null => null,
}));

const SIGN_IN = { label: "Sign in to claim", href: "/auth/login?redirect=%2Frewardhub" };
/** 15 Nov 2026, midday UTC — far from a date boundary in any timezone. */
const EXPIRY = Date.UTC(2026, 10, 15, 12);

const OFFERS: readonly FeaturedOffer[] = [
	{ id: "offer-1", title: "Free coffee — Grand Opening", merchantName: "Brew & Bean KL", category: "cafe", remaining: 142, total: 200, expiryDate: EXPIRY },
	{ id: "offer-2", title: "RM10 off Jonker lunch set", merchantName: undefined, category: "restaurant", remaining: 95, total: 120, expiryDate: EXPIRY },
];

afterEach(() => {
	cleanup();
});

/** No `<button>` may sit inside an `<a>` (invalid HTML; breaks keyboard and screen-reader semantics). */
function expectNoNestedInteractive(container: HTMLElement): void {
	expect(container.querySelectorAll("a button, button a")).toHaveLength(0);
}

describe("LandingHero", () => {
	it("pitches the product with both calls to action as real links", () => {
		const { container } = render(<LandingHero featuredOffers={OFFERS} liveOfferCount={12} secondaryAction={SIGN_IN} />);

		expect(screen.getByRole("heading", { level: 1, name: "Rewards from the places you already love" })).toBeDefined();
		expect(screen.getByRole("link", { name: "Browse offers" }).getAttribute("href")).toBe("/#rewards");
		expect(screen.getByRole("link", { name: "Sign in to claim" }).getAttribute("href")).toBe(SIGN_IN.href);
		expectNoNestedInteractive(container);
	});

	it("shows the real live-offer count, and a dash when it could not be loaded", () => {
		render(<LandingHero featuredOffers={OFFERS} liveOfferCount={12} secondaryAction={SIGN_IN} />);
		expect(screen.getByText("12")).toBeDefined();
		cleanup();

		render(<LandingHero featuredOffers={OFFERS} liveOfferCount={undefined} secondaryAction={SIGN_IN} />);
		expect(screen.getByText("—")).toBeDefined();
	});

	it("previews each featured offer as a link to its detail page", () => {
		render(<LandingHero featuredOffers={OFFERS} liveOfferCount={12} secondaryAction={SIGN_IN} />);

		const preview = screen.getByRole("region", { name: "Ending soon" });
		const links = within(preview).getAllByRole("link");
		expect(links.map((link) => link.getAttribute("href"))).toEqual(["/rewards/offer-1", "/rewards/offer-2"]);
		expect(within(preview).getByText("Brew & Bean KL ·")).toBeDefined();
		expect(within(preview).getAllByText("Until 15 Nov")).toHaveLength(2);
	});

	it("hides the preview when there are no claimable offers", () => {
		render(<LandingHero featuredOffers={[]} liveOfferCount={0} secondaryAction={SIGN_IN} />);

		expect(screen.queryByRole("region", { name: "Ending soon" })).toBeNull();
		expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
	});
});

describe("LandingHowItWorks", () => {
	it("lists exactly the three steps, in order, under the #how-it-works anchor", () => {
		const { container } = render(<LandingHowItWorks />);

		const steps = within(screen.getByRole("list")).getAllByRole("listitem");
		expect(steps.map((step) => within(step).getByRole("heading", { level: 3 }).textContent)).toEqual(["Browse as a guest", "Sign in to claim", "Redeem in store"]);
		expect(container.querySelector("#how-it-works")).not.toBeNull();
	});
});

describe("LandingCallToAction", () => {
	it("renders the supplied copy and action as a link", () => {
		const { container } = render(<LandingCallToAction heading="Ready?" description="It takes a minute." action={{ label: "Open my wallet", href: "/rewardhub/wallet" }} />);

		expect(screen.getByRole("heading", { level: 2, name: "Ready?" })).toBeDefined();
		expect(screen.getByRole("link", { name: "Open my wallet" }).getAttribute("href")).toBe("/rewardhub/wallet");
		expectNoNestedInteractive(container);
	});
});

describe("LandingFooter", () => {
	it("groups links into labelled navigation landmarks", () => {
		render(<LandingFooter />);

		expect(
			within(screen.getByRole("navigation", { name: "Explore" }))
				.getByRole("link", { name: "Browse offers" })
				.getAttribute("href"),
		).toBe("/#rewards");
		expect(
			within(screen.getByRole("navigation", { name: "Your account" }))
				.getByRole("link", { name: "My rewards" })
				.getAttribute("href"),
		).toBe("/rewardhub/wallet");
	});
});

describe("LandingHeader", () => {
	function scrollTo(y: number): void {
		act(() => {
			Object.defineProperty(window, "scrollY", { value: y, configurable: true });
			window.dispatchEvent(new Event("scroll"));
		});
	}

	afterEach(() => {
		scrollTo(0);
	});

	it("blends into the hero at the top and detaches (background + border) once scrolled", () => {
		render(<LandingHeader />);
		const header = screen.getByRole("banner");

		expect(header.hasAttribute("data-detached")).toBe(false);
		expect(header.className).toContain("bg-transparent");

		scrollTo(400);
		expect(header.hasAttribute("data-detached")).toBe(true);
		expect(header.className).toContain("backdrop-blur-md");

		scrollTo(0);
		expect(header.hasAttribute("data-detached")).toBe(false);
	});
});

describe("LandingMerchants", () => {
	it("names each merchant (monograms are decorative)", () => {
		render(<LandingMerchants merchantNames={["Brew & Bean KL", "Jonker Street Kitchen"]} />);

		const list = within(screen.getByRole("region", { name: "Offers from local favourites" })).getByRole("list");
		expect(
			within(list)
				.getAllByRole("listitem")
				.map((item) => item.textContent),
		).toEqual(["BBBrew & Bean KL", "JSJonker Street Kitchen"]);
		expect(list.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
	});

	it("renders nothing when no merchant has a live offer", () => {
		const { container } = render(<LandingMerchants merchantNames={[]} />);

		expect(container.innerHTML).toBe("");
	});
});
