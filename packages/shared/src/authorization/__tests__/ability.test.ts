import { Ability } from "@casl/ability";
import { describe, expect, it } from "vitest";

import type { CapabilitySlug } from "../../contexts/authorization/schemas/capabilities";
import type { PermissionAction, PermissionResource } from "../../contexts/authorization/schemas/permission-enums";
import { abilityAllowsCapability, abilityRules, permissionOfCapability, type AppAbility, type CapabilityNamespace } from "../ability";
import { MERCHANT_CAPABILITY, MERCHANT_CAPABILITY_PERMISSION, MerchantCapabilitySchema, PERMISSION } from "../permission";

/** What every app's ability provider builds from the rules (`new Ability(abilityRules(…))`). */
function defineSessionAbility(capabilities: readonly CapabilitySlug[], namespace: CapabilityNamespace): AppAbility {
	return new Ability<[PermissionAction, PermissionResource]>(abilityRules(capabilities, namespace));
}

describe("the session ability", () => {
	it("allows nothing for an empty capability list (signed out, loading, failed)", () => {
		const ability = defineSessionAbility([], "platform");
		expect(ability.can("READ", "REWARD")).toBe(false);
		expect(ability.rules).toStrictEqual([]);
	});

	it("turns each platform slug into its catalogue action and subject", () => {
		const ability = defineSessionAbility([PERMISSION.PRODUCT.DELETE, PERMISSION.REWARD.REJECT], "platform");
		expect(ability.can("DELETE", "PRODUCT")).toBe(true);
		expect(ability.can("REJECT", "REWARD")).toBe(true);
		expect(ability.can("UPDATE", "PRODUCT")).toBe(false);
	});

	it("turns each merchant capability into the permission the API checks for it", () => {
		const ability = defineSessionAbility([MERCHANT_CAPABILITY.manageTeam], "merchant");
		expect(ability.can("UPDATE", "MEMBER")).toBe(true);
		expect(ability.can("READ", "MEMBER")).toBe(false);
		// The read/write split (ADR 090): seeing the team is its own capability.
		expect(defineSessionAbility([MERCHANT_CAPABILITY.viewTeam], "merchant").can("READ", "MEMBER")).toBe(true);
	});

	it("maps every merchant capability", () => {
		for (const capability of MerchantCapabilitySchema.options) {
			expect(permissionOfCapability(capability)).toStrictEqual(MERCHANT_CAPABILITY_PERMISSION[capability]);
		}
	});

	it("builds only from its own namespace, so a platform grant never shows merchant UI (and back)", () => {
		expect(abilityRules([PERMISSION.REWARD.UPDATE], "merchant")).toStrictEqual([]);
		expect(abilityRules([MERCHANT_CAPABILITY.manageRewards], "platform")).toStrictEqual([]);
	});

	it("ignores an unknown slug instead of failing open", () => {
		expect(abilityRules(["platform:nothing.here"], "platform")).toStrictEqual([]);
		expect(permissionOfCapability("tenant:other")).toBeNull();
	});

	it("never carries a condition: it reflects the API's decision, it does not re-make it", () => {
		for (const rule of abilityRules([PERMISSION.REWARD.READ, PERMISSION.USER.DELETE], "platform")) {
			expect(Object.keys(rule).sort()).toStrictEqual(["action", "subject"]);
		}
	});

	it("checks a capability slug against an ability", () => {
		const ability = defineSessionAbility([PERMISSION.ANALYTICS.READ], "platform");
		expect(abilityAllowsCapability(ability, PERMISSION.ANALYTICS.READ)).toBe(true);
		expect(abilityAllowsCapability(ability, PERMISSION.ANALYTICS.LIST)).toBe(false);
		expect(abilityAllowsCapability(ability, "platform:nothing.here")).toBe(false);
	});
});
