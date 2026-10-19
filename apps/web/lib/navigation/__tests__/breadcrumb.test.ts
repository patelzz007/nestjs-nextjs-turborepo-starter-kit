import { describe, expect, it } from "vitest";

import { resolveWebTrail } from "@/lib/navigation/breadcrumb";
import { rewardDetailPath, ROUTES, walletClaimPath } from "@/lib/routes";

interface Crumb {
	readonly label: string;
	readonly href: string | undefined;
}

function trailOf(pathname: string): readonly Crumb[] {
	return resolveWebTrail(pathname).map((crumb) => ({ label: crumb.label, href: crumb.href }));
}

describe("resolveWebTrail — every signed-in page", () => {
	it("names the browse page by its menu item, with no section crumb", () => {
		expect(trailOf(ROUTES.dashboard.browse)).toEqual([{ label: "Browse Rewards", href: undefined }]);
	});

	it("roots a reward detail page in browse and skips the /dashboard/rewards segment (no page there)", () => {
		expect(trailOf(rewardDetailPath("reward-1"))).toEqual([
			{ label: "Browse Rewards", href: ROUTES.dashboard.browse },
			{ label: "Reward", href: undefined },
		]);
	});

	it("names the wallet page by its menu item", () => {
		expect(trailOf(ROUTES.dashboard.wallet)).toEqual([{ label: "My Wallet", href: undefined }]);
	});

	it("roots a claim's redemption code in the wallet, labelled like the page heading", () => {
		expect(trailOf(walletClaimPath("claim-1"))).toEqual([
			{ label: "My Wallet", href: ROUTES.dashboard.wallet },
			{ label: "Show at checkout", href: undefined },
		]);
	});

	it("names the activity page by its menu item", () => {
		expect(trailOf(ROUTES.dashboard.activity)).toEqual([{ label: "My Activity", href: undefined }]);
	});

	it("names the account page by its bottom menu item (not a disabled section parent)", () => {
		expect(trailOf(ROUTES.dashboard.account)).toEqual([{ label: "Account", href: undefined }]);
	});

	it("never produces a crumb for a URL that is not a page, nor a disabled menu item", () => {
		const signedInPaths: readonly string[] = [
			ROUTES.dashboard.browse,
			rewardDetailPath("reward-1"),
			ROUTES.dashboard.wallet,
			walletClaimPath("claim-1"),
			ROUTES.dashboard.activity,
			ROUTES.dashboard.account,
		];
		for (const pathname of signedInPaths) {
			const linked = resolveWebTrail(pathname)
				.map((crumb) => crumb.href)
				.filter((href): href is string => href !== undefined);
			for (const href of linked) {
				expect([ROUTES.dashboard.browse, ROUTES.dashboard.wallet], `${pathname} links ${href}`).toContain(href);
			}
		}
	});

	it("leaves the final crumb unlinked and gives every crumb an icon", () => {
		for (const pathname of [ROUTES.dashboard.browse, rewardDetailPath("r"), walletClaimPath("c"), ROUTES.dashboard.account]) {
			const trail = resolveWebTrail(pathname);
			expect(trail.at(-1)?.href, pathname).toBeUndefined();
			for (const crumb of trail) {
				expect(crumb.icon, `${pathname} → ${crumb.label}`).toBeDefined();
			}
		}
	});

	it("has no trail on the full-screen auth pages", () => {
		expect(resolveWebTrail(ROUTES.auth.login)).toEqual([]);
	});
});
