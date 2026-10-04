import { describe, expect, it } from "vitest";
import type { PolicyBuilderPayload } from "@workspace/shared";

import { REWARDHUB_DEFAULT_TENANT_CEDAR } from "../../organization/utils/rewardhub-policy-seed.util";
import { CEDAR_ACTIONS, CEDAR_GUARDRAIL_ACTIONS } from "../cedar/rewardhub-cedar-model";
import { POLICY_TEMPLATE_IDS, PolicyTemplateCompiler } from "../services/policy-template.compiler";
import { CedarWasmPolicyEngine } from "./cedar-wasm-policy-engine";
import { PolicyEngineError, type PolicyBundle, type PolicyPrincipal, type PolicyRequest } from "./policy-engine.port";

const engine = new CedarWasmPolicyEngine();
const ORG = "org-1";
const MANAGE_TEAM = "rewardhub:manage_team";

function member(role: string, overrides: Partial<PolicyPrincipal> = {}): PolicyPrincipal {
	return { userId: "user-1", role, locationScope: "ALL_LOCATIONS", locationIds: [], ...overrides };
}

function request(principal: PolicyPrincipal, action: string = MANAGE_TEAM, locationId?: string): PolicyRequest {
	return { organizationId: ORG, principal, action, ...(locationId === undefined ? {} : { locationId }) };
}

function bundle(...sources: string[]): PolicyBundle {
	return { version: 1, sources };
}

const GUARDRAIL: string = new PolicyTemplateCompiler().compile({ templateId: POLICY_TEMPLATE_IDS.platformNoEscalation, parameters: {} }, null).cedarSource;

describe("CedarWasmPolicyEngine (official Cedar engine)", () => {
	describe("decide", () => {
		it("allows the roles the default tenant policy permits and default-denies the rest", () => {
			const tenant = bundle(REWARDHUB_DEFAULT_TENANT_CEDAR);
			for (const role of ["OWNER", "ADMIN", "CASHIER"]) {
				expect(engine.decide(tenant, request(member(role)))).toEqual({ decision: "Allow", diagnostic: "explicit_permit" });
			}
			expect(engine.decide(tenant, request(member("MEMBER")))).toEqual({ decision: "Deny", diagnostic: "default_deny" });
		});

		it("denies everything for an empty bundle (Cedar default deny)", () => {
			expect(engine.decide(bundle(), request(member("OWNER")))).toEqual({ decision: "Deny", diagnostic: "default_deny" });
		});

		it("lets a matching forbid win over a permit, and matches actions exactly", () => {
			const withGuardrail = bundle(REWARDHUB_DEFAULT_TENANT_CEDAR, GUARDRAIL);
			expect(engine.decide(withGuardrail, request(member("OWNER"), CEDAR_GUARDRAIL_ACTIONS.removeLastOwner))).toEqual({ decision: "Deny", diagnostic: "explicit_forbid" });
			expect(engine.decide(withGuardrail, request(member("ADMIN"), CEDAR_GUARDRAIL_ACTIONS.assignPolicyAdmin)).decision).toBe("Deny");
			expect(engine.decide(withGuardrail, request(member("OWNER"), CEDAR_GUARDRAIL_ACTIONS.assignPolicyAdmin)).decision).toBe("Allow");
			expect(engine.decide(withGuardrail, request(member("OWNER"))).decision).toBe("Allow");
		});

		it("evaluates the member's real location scope against store-scoped requests", () => {
			const scoped = bundle(new PolicyTemplateCompiler().compile({ templateId: POLICY_TEMPLATE_IDS.tenantLocationScopeRead, parameters: {} }, ORG).cedarSource);
			const selected = member("CASHIER", { locationScope: "SELECTED", locationIds: ["loc-1"] });
			expect(engine.decide(scoped, request(selected, MANAGE_TEAM, "loc-1")).decision).toBe("Allow");
			expect(engine.decide(scoped, request(selected, MANAGE_TEAM, "loc-2")).decision).toBe("Deny");
			expect(engine.decide(scoped, request(member("CASHIER"), MANAGE_TEAM, "loc-2")).decision).toBe("Allow");
		});

		it("fails closed when a policy errors during evaluation (Cedar would otherwise skip the erroring forbid)", () => {
			// `resource.locationId` without `has` errors when the request names no store.
			const erroringForbid = 'forbid(principal, action, resource) when { resource.locationId == "loc-1" };';
			expect(engine.decide(bundle(REWARDHUB_DEFAULT_TENANT_CEDAR, erroringForbid), request(member("OWNER")))).toEqual({ decision: "Deny", diagnostic: "evaluation_error" });
		});

		it("rejects a request for an action the schema does not declare", () => {
			expect(() => engine.decide(bundle(REWARDHUB_DEFAULT_TENANT_CEDAR), request(member("OWNER"), "rewardhub:undeclared"))).toThrow(PolicyEngineError);
		});

		it("rejects a bundle that does not parse", () => {
			expect(() => engine.decide(bundle("permit(principal, action"), request(member("OWNER")))).toThrow(PolicyEngineError);
		});
	});

	describe("validate", () => {
		it.each([
			["the default tenant policy", REWARDHUB_DEFAULT_TENANT_CEDAR],
			["the no-escalation guardrail", GUARDRAIL],
			...[
				{ templateId: POLICY_TEMPLATE_IDS.tenantRoleCapability, parameters: { allowedRoles: ["OWNER"] } },
				{ templateId: POLICY_TEMPLATE_IDS.tenantLocationScopeRead, parameters: { requireLocationScope: true } },
			].map((payload: PolicyBuilderPayload): [string, string] => [payload.templateId, new PolicyTemplateCompiler().compile(payload, ORG).cedarSource]),
		])("accepts %s", (_label, source) => {
			expect(engine.validate(source)).toEqual({ valid: true });
		});

		it.each([
			["an unknown attribute", 'permit(principal, action, resource) when { principal.department == "x" };'],
			["an undeclared action", 'permit(principal, action == RewardHub::Action::"launchRockets", resource);'],
			["an entity compared with a string", 'forbid(principal, action, resource) when { action == "removeLastOwner" };'],
			["an optional attribute read without `has`", 'permit(principal, action, resource) when { resource.locationId == "loc-1" };'],
			["a syntax error", "permit(principal, action"],
		])("rejects %s", (_label, source) => {
			const result = engine.validate(source);
			expect(result.valid).toBe(false);
			expect(result.valid ? [] : result.errors.length).not.toEqual(0);
		});

		it("declares every runtime and guardrail action", () => {
			for (const action of CEDAR_ACTIONS) {
				expect(engine.validate(`permit(principal, action == RewardHub::Action::${JSON.stringify(action)}, resource);`)).toEqual({ valid: true });
			}
		});
	});
});
