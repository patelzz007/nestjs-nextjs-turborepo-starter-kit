import { describe, expect, it, vi } from "vitest";

import { webProfileMenuItems } from "@/components/layout/web-profile-menu";
import { ROUTES } from "@/lib/routes";

describe("webProfileMenuItems", () => {
	it("offers signed-in members their account settings, after the reward pages", () => {
		const navigate = vi.fn();
		const items = webProfileMenuItems(true, navigate);

		expect(items.map((item) => item.label)).toStrictEqual(["Browse rewards", "My rewards", "Account settings"]);
		items.find((item) => item.label === "Account settings")?.onClick();
		expect(navigate).toHaveBeenCalledWith(ROUTES.dashboard.account);
	});

	it("does not offer account settings to anonymous visitors", () => {
		expect(webProfileMenuItems(false, vi.fn()).map((item) => item.label)).toStrictEqual(["Browse rewards", "My rewards"]);
	});

	it("takes each reward page to its route", () => {
		const navigate = vi.fn();
		const [browse, wallet] = webProfileMenuItems(false, navigate);

		browse?.onClick();
		wallet?.onClick();
		expect(navigate.mock.calls).toStrictEqual([[ROUTES.dashboard.browse], [ROUTES.dashboard.wallet]]);
	});
});
