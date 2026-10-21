import { describe, expect, it } from "vitest";

import { resolveMerchantTrail } from "@/lib/navigation/breadcrumb";
import { createMerchantNavHrefResolver } from "@/lib/navigation/resolve-nav-href";
import { tenantRoutes } from "@/lib/routes";

const SLUG = "acme-coffee";
const routes = tenantRoutes(SLUG);
const resolveHref = createMerchantNavHrefResolver(SLUG);

function trailOf(pathname: string): readonly { readonly label: string; readonly href: string | undefined }[] {
	return resolveMerchantTrail(pathname, resolveHref).map((item) => ({ label: item.label, href: item.href }));
}

describe("resolveMerchantTrail", () => {
	it("names the dashboard", () => {
		expect(trailOf(routes.dashboard)).toEqual([{ label: "Dashboard", href: undefined }]);
	});

	it("nests a settings page under the Settings section", () => {
		expect(trailOf(routes.settings.team)).toEqual([
			{ label: "Settings", href: routes.settings.index },
			{ label: "Team", href: undefined },
		]);
	});

	it("names the personal account page", () => {
		expect(trailOf(routes.account)).toEqual([{ label: "Account", href: undefined }]);
	});

	it("roots a reward page in the rewards list", () => {
		expect(trailOf(routes.rewards.detail("reward-1"))).toEqual([
			{ label: "Rewards", href: undefined },
			{ label: "My Rewards", href: routes.rewards.list },
			{ label: "Reward", href: undefined },
		]);
	});

	it("puts a reward's edit page under the reward, named by its page rather than the raw id", () => {
		expect(trailOf(routes.rewards.edit("reward-1"))).toEqual([
			{ label: "Rewards", href: undefined },
			{ label: "My Rewards", href: routes.rewards.list },
			{ label: "Reward", href: routes.rewards.detail("reward-1") },
			{ label: "Edit reward", href: undefined },
		]);
	});

	it("links an unknown tenant page back to the tenant root", () => {
		expect(trailOf(`${routes.root}/not-a-page`)).toEqual([{ label: "Dashboard", href: routes.root }]);
	});
});
