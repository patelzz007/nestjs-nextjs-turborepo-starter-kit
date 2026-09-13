import { Injectable } from "@nestjs/common";
import type { CedarAuthorizationDecision } from "@workspace/shared";

import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";

export interface CedarEvaluationInput {
	readonly organizationId: string;
	readonly principal: string;
	readonly action: string;
	readonly resource: string;
	readonly membershipRole: string;
	readonly locationScopeType: string;
	readonly locationIds: readonly string[];
}

interface ParsedPolicyRule {
	readonly effect: "permit" | "forbid";
	readonly condition: string | null;
}

@Injectable()
export class CedarPolicyEvaluatorService {
	private readonly bundleCache = new Map<string, { version: number; rules: ParsedPolicyRule[] }>();

	public constructor(private readonly tenantTx: TenantTransactionService) {}

	public async getActivePolicyVersion(organizationId: string): Promise<number> {
		const bundle = await this.loadBundle(organizationId);
		return bundle.version;
	}

	public async evaluate(input: CedarEvaluationInput): Promise<CedarAuthorizationDecision> {
		const bundle = await this.loadBundle(input.organizationId);
		const context = {
			role: input.membershipRole,
			locationScope: input.locationScopeType,
			locationIds: input.locationIds,
		};

		let explicitDeny = false;
		let explicitAllow = false;

		for (const rule of bundle.rules) {
			const matches = this.evaluateRule(rule, input.action, context);
			if (!matches) {
				continue;
			}
			if (rule.effect === "forbid") {
				explicitDeny = true;
			}
			if (rule.effect === "permit") {
				explicitAllow = true;
			}
		}

		const decision = explicitDeny || !explicitAllow ? "Deny" : "Allow";

		return {
			decision,
			diagnostics: explicitDeny ? ["explicit_forbid"] : explicitAllow ? ["explicit_permit"] : ["default_deny"],
			policyVersion: bundle.version,
			evaluatedAt: Date.now(),
		};
	}

	public invalidateOrganization(organizationId: string): void {
		this.bundleCache.delete(organizationId);
		this.bundleCache.delete("platform");
	}

	private async loadBundle(organizationId: string): Promise<{ version: number; rules: ParsedPolicyRule[] }> {
		const cached = this.bundleCache.get(organizationId);
		if (cached !== undefined) {
			return cached;
		}

		const versions = await this.tenantTx.withSystemOperation(
			{
				operation: "policy.publish",
				reason: "Load policy bundle",
				correlationId: `policy-load:${organizationId}`,
				actorUserId: null,
			},
			async (tx) => {
				return tx.authorizationPolicyVersion.findMany({
					where: {
						OR: [{ organizationId }, { organizationId: null, scope: "PLATFORM_GUARDRAIL" }],
						supersededAt: null,
					},
					orderBy: { version: "desc" },
				});
			},
		);

		const rules: ParsedPolicyRule[] = [];
		let maxVersion = 1;

		for (const v of versions) {
			maxVersion = Math.max(maxVersion, v.version);
			rules.push(...this.parseCedarSource(v.cedarSource));
		}

		if (rules.length === 0) {
			rules.push({ effect: "permit", condition: null });
		}

		const bundle = { version: maxVersion, rules };
		this.bundleCache.set(organizationId, bundle);
		return bundle;
	}

	private parseCedarSource(source: string): ParsedPolicyRule[] {
		const lines = source.split("\n").filter((l) => l.trim().length > 0);
		const rules: ParsedPolicyRule[] = [];
		for (const line of lines) {
			const trimmed = line.trim();
			if (trimmed.startsWith("permit(")) {
				rules.push({ effect: "permit", condition: this.extractCondition(trimmed) });
			}
			if (trimmed.startsWith("forbid(")) {
				rules.push({ effect: "forbid", condition: this.extractCondition(trimmed) });
			}
		}
		return rules;
	}

	private extractCondition(line: string): string | null {
		const whenIdx = line.indexOf(" when ");
		if (whenIdx === -1) {
			return null;
		}
		return line
			.slice(whenIdx + 6)
			.replace(/;$/, "")
			.replace(/^\{ /, "")
			.replace(/ \}$/, "");
	}

	private evaluateRule(rule: ParsedPolicyRule, action: string, context: { role: string; locationScope: string; locationIds: readonly string[] }): boolean {
		if (rule.condition === null) {
			return true;
		}
		if (rule.condition.includes("removeLastOwner") && action.includes("removeLastOwner")) {
			return true;
		}
		if (rule.condition.includes("assignPolicyAdmin") && action.includes("assignPolicyAdmin")) {
			return context.role !== "OWNER";
		}
		if (rule.condition.includes("principal.role")) {
			const roleMatch = rule.condition.match(/principal\.role == "(\w+)"/g);
			if (roleMatch !== null) {
				const allowed = roleMatch.map((m) => m.replace(/principal\.role == "/, "").replace('"', ""));
				return allowed.includes(context.role);
			}
		}
		if (rule.condition.includes("locationScope")) {
			return context.locationScope === "ALL_LOCATIONS" || context.locationIds.length > 0;
		}
		return false;
	}
}
