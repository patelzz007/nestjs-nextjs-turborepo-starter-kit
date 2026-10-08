import { Injectable, Logger } from "@nestjs/common";
import type { PolicyDefinition } from "@prisma/client";
import type {
	AuthorizationAttributeValue,
	AuthorizationContext,
	AuthorizationEvaluationStep,
	AuthorizationRequest,
	PolicyCondition,
	PolicyOperator,
	PolicyRule,
	PolicyValue,
} from "@workspace/shared";
import { isArrayValue, isNumberPrimitive, isStringPrimitive, PolicyConditionsSchema } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Outcome of the ABAC layer for one request:
 * - `NOT_APPLICABLE` — no active policy targets this action/resource
 * - `ALLOW` — at least one conditional ALLOW policy matched and no DENY matched
 * - `DENY` — a DENY policy matched, or ALLOW policies exist but none matched
 */
export type PolicyDecision = "ALLOW" | "DENY" | "NOT_APPLICABLE";

export interface PolicyEvaluation {
	readonly decision: PolicyDecision;
	readonly evaluation: readonly AuthorizationEvaluationStep[];
}

function readSubjectField(subject: AuthorizationContext, key: string): AuthorizationAttributeValue {
	switch (key) {
		case "userId":
		case "id":
			return subject.userId;
		case "organizationId":
			return subject.organizationId ?? null;
		case "storeId":
			return subject.storeId ?? null;
		case "locationId":
			return subject.locationId ?? null;
		case "isSuperAdmin":
			return subject.isSuperAdmin ?? null;
		case "roles":
			return subject.roles ?? null;
		default:
			return subject.attributes?.[key] ?? null;
	}
}

function isScalarMember(value: AuthorizationAttributeValue): value is string | number {
	return isStringPrimitive(value) || isNumberPrimitive(value);
}

function compareNumbers(fieldValue: AuthorizationAttributeValue, compareValue: PolicyValue, compare: (left: number, right: number) => boolean): boolean {
	if (!isNumberPrimitive(fieldValue) || !isNumberPrimitive(compareValue)) {
		return false;
	}
	return compare(fieldValue, compareValue);
}

function compareStrings(fieldValue: AuthorizationAttributeValue, compareValue: PolicyValue, compare: (left: string, right: string) => boolean): boolean {
	if (!isStringPrimitive(fieldValue) || !isStringPrimitive(compareValue)) {
		return false;
	}
	return compare(fieldValue, compareValue);
}

/** Array membership, or substring when both sides are strings. */
function containsValue(fieldValue: AuthorizationAttributeValue, compareValue: PolicyValue): boolean {
	if (isArrayValue(fieldValue) && isScalarMember(compareValue)) {
		return fieldValue.some((member) => member === compareValue);
	}
	return compareStrings(fieldValue, compareValue, (left, right) => left.includes(right));
}

function inList(fieldValue: AuthorizationAttributeValue, compareValue: PolicyValue): boolean {
	if (!isArrayValue(compareValue) || !isScalarMember(fieldValue)) {
		return false;
	}
	return compareValue.some((member) => member === fieldValue);
}

/**
 * Apply one operator of the constrained DSL. Only the operators enumerated in
 * `PolicyOperatorSchema` exist — there is no code path that executes stored code.
 */
export function applyPolicyOperator(operator: PolicyOperator, fieldValue: AuthorizationAttributeValue, compareValue: PolicyValue): boolean {
	switch (operator) {
		case "equals":
			return fieldValue === compareValue;
		case "not_equals":
			return fieldValue !== compareValue;
		case "in":
			return inList(fieldValue, compareValue);
		case "not_in":
			return isArrayValue(compareValue) && isScalarMember(fieldValue) && !inList(fieldValue, compareValue);
		case "contains":
			return containsValue(fieldValue, compareValue);
		case "not_contains":
			return (isStringPrimitive(fieldValue) || isArrayValue(fieldValue)) && !containsValue(fieldValue, compareValue);
		case "starts_with":
			return compareStrings(fieldValue, compareValue, (left, right) => left.startsWith(right));
		case "ends_with":
			return compareStrings(fieldValue, compareValue, (left, right) => left.endsWith(right));
		case "greater_than":
			return compareNumbers(fieldValue, compareValue, (left, right) => left > right);
		case "greater_than_or_equals":
			return compareNumbers(fieldValue, compareValue, (left, right) => left >= right);
		case "less_than":
			return compareNumbers(fieldValue, compareValue, (left, right) => left < right);
		case "less_than_or_equals":
			return compareNumbers(fieldValue, compareValue, (left, right) => left <= right);
		case "exists":
			return fieldValue !== null;
		case "not_exists":
			return fieldValue === null;
	}
}

/**
 * Resolve a condition field against the request:
 * - `$user.<key>` → subject attribute
 * - `$resource.<key>` or `<resource>.<key>` (e.g. `order.status`) → resource attribute
 * - `<key>` → resource attribute
 */
function resolveField(field: string, request: AuthorizationRequest): AuthorizationAttributeValue {
	if (field.startsWith("$user.")) {
		return readSubjectField(request.subject, field.slice("$user.".length));
	}
	const resourcePrefix = `${request.resource.toLowerCase()}.`;
	const key = field.startsWith("$resource.") ? field.slice("$resource.".length) : field.startsWith(resourcePrefix) ? field.slice(resourcePrefix.length) : field;
	return request.resourceAttributes?.[key] ?? null;
}

function resolveComparison(condition: PolicyCondition, request: AuthorizationRequest): PolicyValue {
	if (condition.valueRef === undefined) {
		return condition.value ?? null;
	}
	return resolveField(condition.valueRef, request);
}

/** Recursively evaluate a validated rule. A rule with no branch never matches. */
export function matchesPolicyRule(rule: PolicyRule, request: AuthorizationRequest): boolean {
	if (rule.all !== undefined) {
		return rule.all.every((child) => matchesPolicyRule(child, request));
	}
	if (rule.any !== undefined) {
		return rule.any.some((child) => matchesPolicyRule(child, request));
	}
	if (rule.condition !== undefined) {
		return applyPolicyOperator(rule.condition.operator, resolveField(rule.condition.field, request), resolveComparison(rule.condition, request));
	}
	return false;
}

/**
 * Policy Engine — evaluates the Zod-validated policy DSL (ABAC).
 *
 * Semantics (fail closed):
 * 1. A matching DENY policy denies.
 * 2. When conditional ALLOW policies target the request, at least one must match.
 * 3. A policy whose stored conditions fail validation is treated as matching when
 *    it is a DENY policy and as not matching when it is an ALLOW policy.
 * 4. With no applicable policy the layer abstains (`NOT_APPLICABLE`).
 */
@Injectable()
export class PolicyEngineService {
	private readonly logger = new Logger(PolicyEngineService.name);

	public constructor(private readonly prisma: PrismaService) {}

	public async evaluate(request: AuthorizationRequest): Promise<PolicyEvaluation> {
		const policies = await this.findApplicablePolicies(request);

		if (policies.length === 0) {
			return {
				decision: "NOT_APPLICABLE",
				evaluation: [{ source: "policy", effect: "NO_MATCH", reason: "No active policy targets this request" }],
			};
		}

		const evaluation: AuthorizationEvaluationStep[] = [];
		let allowPolicies = 0;
		let allowMatched = false;

		for (const policy of policies) {
			const matched = this.matches(policy, request);
			if (policy.effect === "DENY") {
				if (matched) {
					evaluation.push({ source: "policy", effect: "DENY", reason: `Policy "${policy.name}" (v${String(policy.version)}) denies`, details: { policyId: policy.id } });
					return { decision: "DENY", evaluation };
				}
				evaluation.push({ source: "policy", effect: "NO_MATCH", reason: `Deny policy "${policy.name}" did not match`, details: { policyId: policy.id } });
				continue;
			}

			allowPolicies += 1;
			if (matched) {
				allowMatched = true;
				evaluation.push({ source: "policy", effect: "ALLOW", reason: `Policy "${policy.name}" (v${String(policy.version)}) allows`, details: { policyId: policy.id } });
			} else {
				evaluation.push({ source: "policy", effect: "NO_MATCH", reason: `Allow policy "${policy.name}" conditions not met`, details: { policyId: policy.id } });
			}
		}

		if (allowPolicies === 0) {
			return { decision: "NOT_APPLICABLE", evaluation };
		}

		if (!allowMatched) {
			evaluation.push({ source: "policy", effect: "DENY", reason: "Conditional allow policies exist but none matched" });
			return { decision: "DENY", evaluation };
		}

		return { decision: "ALLOW", evaluation };
	}

	/** Evaluate stored JSON conditions (used by ACL entries as well). `null` = unconditional. */
	public matchesStoredConditions(conditions: PolicyDefinition["conditions"], request: AuthorizationRequest, failClosedAs: boolean): boolean {
		if (conditions === null) {
			return true;
		}
		const parsed = PolicyConditionsSchema.safeParse(conditions);
		if (!parsed.success) {
			this.logger.error(`Rejected malformed authorization conditions: ${parsed.error.message}`);
			return failClosedAs;
		}
		return matchesPolicyRule(parsed.data, request);
	}

	/**
	 * Whether an active DENY policy without conditions targets the request —
	 * such a policy removes every row from list filters.
	 */
	public async hasUnconditionalDeny(request: AuthorizationRequest): Promise<boolean> {
		const policies = await this.findApplicablePolicies(request);
		return policies.some((policy) => policy.effect === "DENY" && policy.conditions === null);
	}

	/** Active policies for the action/resource, bound to no tenant or to the verified tenant. */
	private async findApplicablePolicies(request: AuthorizationRequest): Promise<PolicyDefinition[]> {
		return this.prisma.policyDefinition.findMany({
			where: {
				isActive: true,
				isDeleted: false,
				actions: { has: request.action },
				resources: { has: request.resource },
				AND: [
					{ OR: [{ organizationId: null }, ...(request.subject.organizationId === undefined ? [] : [{ organizationId: request.subject.organizationId }])] },
					{ OR: [{ locationId: null }, ...(request.subject.locationId === undefined ? [] : [{ locationId: request.subject.locationId }])] },
				],
			},
			orderBy: { createdAt: "asc" },
		});
	}

	private matches(policy: PolicyDefinition, request: AuthorizationRequest): boolean {
		// Malformed DENY → matches (deny); malformed ALLOW → does not match.
		return this.matchesStoredConditions(policy.conditions, request, policy.effect === "DENY");
	}
}
