import { Injectable, Logger } from "@nestjs/common";
import type {
	AuthorizationRequest,
	AuthorizationResult,
	AuthorizationEvaluationStep,
	PolicyConditions,
	PolicyCondition,
	PolicyRule,
	PolicyValue,
} from "@workspace/shared";
import { PolicyConditionsSchema } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Policy Engine - evaluates Zod-validated policy DSL.
 * No arbitrary JavaScript - only validated conditions.
 */
@Injectable()
export class PolicyEngineService {
	private readonly logger = new Logger(PolicyEngineService.name);

	public constructor(private readonly prisma: PrismaService) {}

	/**
	 * Evaluate all applicable policies for a request.
	 */
	public async evaluate(request: AuthorizationRequest): Promise<AuthorizationResult> {
		const evaluation: AuthorizationEvaluationStep[] = [];

		// Fetch applicable policies
		const policies = await this.prisma.policyDefinition.findMany({
			where: {
				isActive: true,
				isDeleted: false,
				actions: { has: request.action },
				resources: { has: request.resource },
				OR: [
					{ organizationId: null },
					{ organizationId: request.subject.organizationId },
				],
			},
		});

		if (policies.length === 0) {
			evaluation.push({
				source: "policy",
				effect: "NO_MATCH",
				reason: "No active policies found for this request",
			});

			return {
				decision: "ALLOW",
				request,
				evaluation,
			};
		}

		// Evaluate each policy
		for (const policy of policies) {
			if (policy.conditions === null) {
				continue;
			}

			try {
				const conditions = PolicyConditionsSchema.parse(policy.conditions);
				const result = this.evaluateRule(conditions, request);

				if (result) {
					evaluation.push({
						source: "policy",
						effect: policy.effect === "ALLOW" ? "ALLOW" : "DENY",
						reason: `Policy "${policy.name}" (v${policy.version}) matched`,
						details: { policyId: policy.id },
					});

					// If any policy denies, return DENY immediately
					if (policy.effect === "DENY") {
						return {
							decision: "DENY",
							request,
							evaluation,
						};
					}
				} else {
					evaluation.push({
						source: "policy",
						effect: "NO_MATCH",
						reason: `Policy "${policy.name}" (v${policy.version}) did not match`,
					});
				}
			} catch (error) {
				this.logger.error(`Failed to evaluate policy ${policy.id}: ${(error as Error).message}`);
				evaluation.push({
					source: "policy",
					effect: "NO_MATCH",
					reason: `Policy evaluation error: ${(error as Error).message}`,
				});
			}
		}

		// If any policy matched with ALLOW effect, allow
		const hasAllowMatch = evaluation.some((step) => step.source === "policy" && step.effect === "ALLOW");

		return {
			decision: hasAllowMatch ? "ALLOW" : "DENY",
			request,
			evaluation,
		};
	}

	/**
	 * Evaluate a policy rule recursively.
	 */
	private evaluateRule(rule: PolicyRule, request: AuthorizationRequest): boolean {
		// ALL: all conditions must be true
		if (rule.all !== undefined) {
			return rule.all.every((subRule) => this.evaluateRule(subRule, request));
		}

		// ANY: at least one condition must be true
		if (rule.any !== undefined) {
			return rule.any.some((subRule) => this.evaluateRule(subRule, request));
		}

		// CONDITION: evaluate the condition
		if (rule.condition !== undefined) {
			return this.evaluateCondition(rule.condition, request);
		}

		// Empty rule always fails
		return false;
	}

	/**
	 * Evaluate a single policy condition.
	 */
	private evaluateCondition(condition: PolicyCondition, request: AuthorizationRequest): boolean {
		// Resolve the field value
		const fieldValue = this.resolveField(condition.field, request);

		// Resolve the comparison value
		let compareValue: PolicyValue;

		if (condition.valueRef !== undefined) {
			// Reference to actor attribute like $user.organizationId
			compareValue = this.resolveValueRef(condition.valueRef, request);
		} else {
			compareValue = condition.value;
		}

		// Apply operator
		return this.applyOperator(condition.operator, fieldValue, compareValue);
	}

	/**
	 * Resolve a field value from the request.
	 * Supports dot notation like "order.organizationId" or "$user.organizationId".
	 */
	private resolveField(field: string, request: AuthorizationRequest): unknown {
		if (field.startsWith("$user.")) {
			const key = field.slice(6);
			return request.subject[key as keyof typeof request.subject] ?? null;
		}

		if (field.startsWith("$resource.")) {
			const key = field.slice(10);
			return request.resourceAttributes?.[key] ?? null;
		}

		// Default: look in resource attributes
		return request.resourceAttributes?.[field] ?? null;
	}

	/**
	 * Resolve a value reference like "$user.organizationId".
	 */
	private resolveValueRef(valueRef: string, request: AuthorizationRequest): PolicyValue {
		if (valueRef.startsWith("$user.")) {
			const key = valueRef.slice(6);
			const value = request.subject[key as keyof typeof request.subject];
			return value !== undefined ? (value as PolicyValue) : null;
		}

		if (valueRef.startsWith("$resource.")) {
			const key = valueRef.slice(10);
			return (request.resourceAttributes?.[key] as PolicyValue) ?? null;
		}

		return null;
	}

	/**
	 * Apply a policy operator to values.
	 */
	private applyOperator(operator: string, fieldValue: unknown, compareValue: PolicyValue): boolean {
		switch (operator) {
			case "equals": {
				return fieldValue === compareValue;
			}
			case "not_equals": {
				return fieldValue !== compareValue;
			}
			case "in": {
				if (!Array.isArray(compareValue)) {
					return false;
				}
				return compareValue.includes(fieldValue as string | number);
			}
			case "not_in": {
				if (!Array.isArray(compareValue)) {
					return false;
				}
				return !compareValue.includes(fieldValue as string | number);
			}
			case "contains": {
				if (typeof fieldValue !== "string" || typeof compareValue !== "string") {
					return false;
				}
				return fieldValue.includes(compareValue);
			}
			case "not_contains": {
				if (typeof fieldValue !== "string" || typeof compareValue !== "string") {
					return false;
				}
				return !fieldValue.includes(compareValue);
			}
			case "starts_with": {
				if (typeof fieldValue !== "string" || typeof compareValue !== "string") {
					return false;
				}
				return fieldValue.startsWith(compareValue);
			}
			case "ends_with": {
				if (typeof fieldValue !== "string" || typeof compareValue !== "string") {
					return false;
				}
				return fieldValue.endsWith(compareValue);
			}
			case "greater_than": {
				if (typeof fieldValue !== "number" || typeof compareValue !== "number") {
					return false;
				}
				return fieldValue > compareValue;
			}
			case "greater_than_or_equals": {
				if (typeof fieldValue !== "number" || typeof compareValue !== "number") {
					return false;
				}
				return fieldValue >= compareValue;
			}
			case "less_than": {
				if (typeof fieldValue !== "number" || typeof compareValue !== "number") {
					return false;
				}
				return fieldValue < compareValue;
			}
			case "less_than_or_equals": {
				if (typeof fieldValue !== "number" || typeof compareValue !== "number") {
					return false;
				}
				return fieldValue <= compareValue;
			}
			case "exists": {
				return fieldValue !== null && fieldValue !== undefined;
			}
			case "not_exists": {
				return fieldValue === null || fieldValue === undefined;
			}
			default: {
				this.logger.warn(`Unknown operator: ${operator}`);
				return false;
			}
		}
	}
}
