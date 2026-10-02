import { describe, expect, it } from "vitest";

import { resolveMerchantTrail } from "@/lib/navigation/breadcrumb";
import { createMerchantNavHrefResolver } from "@/lib/navigation/resolve-nav-href";
import { orgRoutes } from "@/lib/routes";

const SLUG = "acme-coffee";
const routes = orgRoutes(SLUG);
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

	it("roots a reward edit page in the rewards list", () => {
		const trail = trailOf(routes.rewards.edit("reward-1"));

		// The reward id has no page of its own, so it is not a crumb.
		expect(trail).toEqual([
			{ label: "Rewards", href: undefined },
			{ label: "My Rewards", href: routes.rewards.list },
			{ label: "Edit reward", href: undefined },
		]);
	});

	it("links an unknown org page back to the organization root", () => {
		expect(trailOf(`${routes.root}/not-a-page`)).toEqual([{ label: "Dashboard", href: routes.root }]);
	});
});
