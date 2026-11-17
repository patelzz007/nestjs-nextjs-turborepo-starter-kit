import { epochMs, type FeatureFlagBundle } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { CUSTOMER_TIERS_FEATURE, enabledAdminFeatureFlags, MERCHANT_INVITES_FEATURE, SHOWCASE_FEATURE } from "../feature-flags";

const NOW = 1_800_000_000_000;

function bundle(on: Readonly<Record<string, boolean>>): FeatureFlagBundle {
	return {
		version: 1,
		app: "admin",
		evaluatedAt: epochMs(NOW),
		nextChangeAt: null,
		flags: [
			{ key: "showcase", on: on.showcase ?? false, source: "RULE", revision: 1, ruleId: null },
			{ key: "merchant-invites", on: on["merchant-invites"] ?? true, source: "DEFAULT", revision: null, ruleId: null },
			{ key: "customer-tiers", on: on["customer-tiers"] ?? true, source: "DEFAULT", revision: null, ruleId: null },
		],
		configs: [],
	};
}

describe("enabledAdminFeatureFlags", () => {
	it("follows the API's bundle", () => {
		expect(enabledAdminFeatureFlags(bundle({ showcase: true }), { merchantInvitesOffered: true })).toStrictEqual([
			SHOWCASE_FEATURE,
			MERCHANT_INVITES_FEATURE,
			CUSTOMER_TIERS_FEATURE,
		]);
		expect(enabledAdminFeatureFlags(bundle({ "customer-tiers": false }), { merchantInvitesOffered: true })).toStrictEqual([MERCHANT_INVITES_FEATURE]);
	});

	it("never offers merchant invites on a single-tenant deployment, whatever the flag says", () => {
		expect(enabledAdminFeatureFlags(bundle({}), { merchantInvitesOffered: false })).not.toContain(MERCHANT_INVITES_FEATURE);
	});

	it("falls back to each flag's code default when the API couldn't answer: the showcase stays off", () => {
		expect(enabledAdminFeatureFlags(null, { merchantInvitesOffered: true })).toStrictEqual([MERCHANT_INVITES_FEATURE, CUSTOMER_TIERS_FEATURE]);
	});
});
