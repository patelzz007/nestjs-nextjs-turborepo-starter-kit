import { OrganizationLocationScopeTypeSchema, OrganizationMembershipRoleSchema, type OrganizationMembershipRole, type PolicyBuilderPayload } from "@workspace/shared";
import { z } from "zod";

import type { CompiledPolicy, PolicyCompilation, PolicyTemplateCompilerPort } from "../../application/ports/policy-control-plane.port";
import { CEDAR_GUARDRAIL_ACTIONS, cedarActionLiteral } from "./cedar-model";

export type { CompiledPolicy };

/** A builder payload the compiler cannot turn into policy (unknown template, invalid parameters). */
export class PolicyTemplateError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "PolicyTemplateError";
	}
}

/** The builder templates the compiler supports (the only way policy source is produced). */
export const POLICY_TEMPLATE_IDS = {
	tenantRoleCapability: "tenant.role_capability",
	platformNoEscalation: "platform.guardrail.no_escalation",
	tenantLocationScopeRead: "tenant.location_scope_read",
} satisfies Record<string, string>;

/** Roles a role-capability template may name — validated, never interpolated unchecked. */
const AllowedRolesSchema = z.array(OrganizationMembershipRoleSchema).min(1);
const DEFAULT_ALLOWED_ROLES: readonly OrganizationMembershipRole[] = [OrganizationMembershipRoleSchema.enum.OWNER, OrganizationMembershipRoleSchema.enum.ADMIN];
const OWNER_ROLE: OrganizationMembershipRole = OrganizationMembershipRoleSchema.enum.OWNER;
const ALL_LOCATIONS = OrganizationLocationScopeTypeSchema.enum.ALL_LOCATIONS;

/** Only an owner may transfer ownership — part of every tenant role-capability policy. */
const OWNER_TRANSFER_GUARD = `forbid(principal, action == ${cedarActionLiteral(CEDAR_GUARDRAIL_ACTIONS.transferOwnership)}, resource) when { principal.role != ${JSON.stringify(OWNER_ROLE)} };`;

function organizationPredicate(organizationId: string | null): string | null {
	return organizationId === null ? null : `"organizationId" = '${organizationId}'`;
}

/**
 * Compiles constrained builder templates to Cedar source (valid against the
 * tenant Cedar schema — `cedar-model.ts`) and SQL visibility
 * predicates. Every value placed in policy text is validated or a constant.
 */
export class PolicyTemplateCompiler {
	public compile(payload: PolicyBuilderPayload, organizationId: string | null): CompiledPolicy {
		switch (payload.templateId) {
			case POLICY_TEMPLATE_IDS.tenantRoleCapability:
				return this.compileRoleCapability(payload, organizationId);
			case POLICY_TEMPLATE_IDS.platformNoEscalation:
				return this.compileNoEscalationGuardrail();
			case POLICY_TEMPLATE_IDS.tenantLocationScopeRead:
				return this.compileLocationScopeRead(payload, organizationId);
			default:
				throw new PolicyTemplateError(`Unknown policy template "${payload.templateId}"`);
		}
	}

	private compileRoleCapability(payload: PolicyBuilderPayload, organizationId: string | null): CompiledPolicy {
		const requested = payload.parameters.allowedRoles;
		let roles: readonly OrganizationMembershipRole[] = DEFAULT_ALLOWED_ROLES;
		if (requested !== undefined) {
			const parsed = AllowedRolesSchema.safeParse(requested);
			if (!parsed.success) {
				throw new PolicyTemplateError(`allowedRoles must be a non-empty list of: ${OrganizationMembershipRoleSchema.options.join(", ")}`);
			}
			roles = parsed.data;
		}
		const roleCheck = roles.map((role: OrganizationMembershipRole): string => `principal.role == ${JSON.stringify(role)}`).join(" || ");
		return {
			cedarSource: `${OWNER_TRANSFER_GUARD}\npermit(principal, action, resource) when { ${roleCheck} };`,
			sqlPredicate: organizationPredicate(organizationId),
		};
	}

	private compileNoEscalationGuardrail(): CompiledPolicy {
		return {
			cedarSource: [
				`forbid(principal, action == ${cedarActionLiteral(CEDAR_GUARDRAIL_ACTIONS.assignPolicyAdmin)}, resource) when { principal.role != ${JSON.stringify(OWNER_ROLE)} };`,
				`forbid(principal, action == ${cedarActionLiteral(CEDAR_GUARDRAIL_ACTIONS.removeLastOwner)}, resource);`,
			].join("\n"),
			sqlPredicate: null,
		};
	}

	private compileLocationScopeRead(payload: PolicyBuilderPayload, organizationId: string | null): CompiledPolicy {
		const requireScope = payload.parameters.requireLocationScope === true;
		const sql =
			organizationId !== null
				? requireScope
					? `"organizationId" = '${organizationId}' AND ("locationId" IS NULL OR "locationId" = ANY($locationIds))`
					: `"organizationId" = '${organizationId}'`
				: null;
		return {
			cedarSource: `permit(principal, action, resource) when { principal.locationScope == ${JSON.stringify(ALL_LOCATIONS)} || (resource has locationId && principal.locationIds.contains(resource.locationId)) };`,
			sqlPredicate: sql,
		};
	}
}

/** The compiler behind the application's port: a template error becomes an `invalid` result the handler answers with 400. */
export class PolicyTemplateCompilerAdapter implements PolicyTemplateCompilerPort {
	private readonly compiler: PolicyTemplateCompiler = new PolicyTemplateCompiler();

	public compile(payload: PolicyBuilderPayload, organizationId: string | null): PolicyCompilation {
		try {
			return { kind: "compiled", policy: this.compiler.compile(payload, organizationId) };
		} catch (error) {
			if (error instanceof PolicyTemplateError) {
				return { kind: "invalid", message: error.message };
			}
			throw error;
		}
	}
}
