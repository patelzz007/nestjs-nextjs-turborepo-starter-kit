import type { PolicyBuilderPayload } from "@workspace/shared";

export interface CompiledPolicy {
	readonly cedarSource: string;
	readonly sqlPredicate: string | null;
}

const PLATFORM_OWNER_GUARD = `forbid(principal, action, resource) when { resource has organizationId && principal.role != "OWNER" && action == "transferOwnership" };`;

/** Compiles constrained builder templates to Cedar source and SQL visibility predicates. */
export class PolicyTemplateCompiler {
	public compile(payload: PolicyBuilderPayload, organizationId: string | null): CompiledPolicy {
		switch (payload.templateId) {
			case "tenant.role_capability":
				return this.compileRoleCapability(payload, organizationId);
			case "platform.guardrail.no_escalation":
				return this.compileNoEscalationGuardrail();
			case "tenant.location_scope_read":
				return this.compileLocationScopeRead(payload, organizationId);
			default:
				return {
					cedarSource: `${PLATFORM_OWNER_GUARD}\npermit(principal, action, resource);`,
					sqlPredicate: organizationId !== null ? `"organization_id" = '${organizationId}'` : null,
				};
		}
	}

	private compileRoleCapability(payload: PolicyBuilderPayload, organizationId: string | null): CompiledPolicy {
		const allowedRoles = payload.parameters.allowedRoles;
		const roles: string[] = Array.isArray(allowedRoles) ? allowedRoles.map(String) : ["OWNER", "ADMIN"];
		const roleCheck = roles.map((r) => `principal.role == "${r}"`).join(" || ");
		return {
			cedarSource: `${PLATFORM_OWNER_GUARD}\npermit(principal, action, resource) when { ${roleCheck} };`,
			sqlPredicate: organizationId !== null ? `"organization_id" = '${organizationId}'` : null,
		};
	}

	private compileNoEscalationGuardrail(): CompiledPolicy {
		return {
			cedarSource: `forbid(principal, action, resource) when { action == "assignPolicyAdmin" && principal.role != "OWNER" };
forbid(principal, action, resource) when { action == "removeLastOwner" };`,
			sqlPredicate: null,
		};
	}

	private compileLocationScopeRead(payload: PolicyBuilderPayload, organizationId: string | null): CompiledPolicy {
		const requireScope = payload.parameters.requireLocationScope === true;
		const sql =
			organizationId !== null
				? requireScope
					? `"organization_id" = '${organizationId}' AND ("location_id" IS NULL OR "location_id" = ANY($locationIds))`
					: `"organization_id" = '${organizationId}'`
				: null;
		return {
			cedarSource: `permit(principal, action, resource) when { principal.locationScope == "ALL_LOCATIONS" || resource.locationId in principal.locationIds };`,
			sqlPredicate: sql,
		};
	}
}
