import { describe, expect, it } from "vitest";

import { isRewardJustForViewer } from "@/contexts/rewards/lib/reward-audience";

describe("isRewardJustForViewer", () => {
	it("is true only for a reward given to chosen customers", () => {
		expect(isRewardJustForViewer({ audienceType: "SELECTED_CUSTOMERS" })).toBe(true);
		expect(isRewardJustForViewer({ audienceType: "EVERYONE" })).toBe(false);
	});
});
