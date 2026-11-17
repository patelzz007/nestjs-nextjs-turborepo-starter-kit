import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { describeCondition, describeRollout, formatWhen } from "../release-labels";

const DAY_MS = 86_400_000;
const START = epochMs(1_767_225_600_000);

describe("formatWhen", () => {
	it("shows a dash for no time", () => {
		expect(formatWhen(null)).toBe("—");
	});

	it("shows a date with its year", () => {
		expect(formatWhen(START)).toContain("2026");
	});
});

describe("describeCondition", () => {
	it("reads each kind of condition as a sentence", () => {
		expect(describeCondition({ attribute: "EMAIL_DOMAIN", operator: "IN", values: ["example.com", "test.dev"] })).toBe("Email domain is one of example.com, test.dev");
		expect(describeCondition({ attribute: "TENANT_ID", operator: "NOT_IN", values: ["t-1"] })).toContain("is none of t-1");
		expect(describeCondition({ attribute: "PLATFORM_STAFF", is: true })).toBe("Is platform staff");
		expect(describeCondition({ attribute: "PLATFORM_STAFF", is: false })).toBe("Isn't platform staff");
		expect(describeCondition({ attribute: "PERMISSION", operator: "LACKS", permission: { action: "READ", resource: "ADMIN_DASHBOARD" } })).toBe("Lacks READ:ADMIN_DASHBOARD");
		expect(describeCondition({ attribute: "APP_VERSION", operator: "AT_LEAST", version: "2.0.0" })).toBe("App version at least 2.0.0");
		expect(describeCondition({ attribute: "APP_VERSION", operator: "BELOW", version: "2.0.0" })).toBe("App version below 2.0.0");
		expect(describeCondition({ attribute: "FLAG_GROUP", operator: "NOT_IN_GROUP", groupKey: "beta" })).toBe("Not in the group beta");
		expect(describeCondition({ attribute: "TIME", from: null, until: null })).toBe("Between — and —");
	});
});

describe("describeRollout", () => {
	it("reads a fixed share", () => {
		expect(describeRollout({ kind: "FIXED", percentage: 25 }, START)).toBe("25% of them");
	});

	it("reads a scheduled ramp with its share now", () => {
		const rollout = {
			kind: "SCHEDULED",
			steps: [
				{ at: START, percentage: 10 },
				{ at: epochMs(START + DAY_MS), percentage: 100 },
			],
		} satisfies Parameters<typeof describeRollout>[0];
		expect(describeRollout(rollout, START + 1)).toMatch(/^10% now \(10% from .+, then 100% from .+\)$/u);
		expect(describeRollout(rollout, START - 1)).toMatch(/^0% now/u);
	});
});
