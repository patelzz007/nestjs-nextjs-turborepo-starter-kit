import { SeparationOfDutyViolationError } from "../errors/authorization.errors";
import { ROLE_SEPARATION_OF_DUTY_RULES, type RoleSeparationOfDutyRule } from "../rbac-catalog";

/**
 * Separation-of-duty rules violated by holding every role in `effectiveRoleNames` at once. The names are
 * the user's live, active roles (the set the kernel evaluates; roles are flat).
 */
export function findSeparationOfDutyViolations(
	effectiveRoleNames: ReadonlySet<string>,
	rules: readonly RoleSeparationOfDutyRule[] = ROLE_SEPARATION_OF_DUTY_RULES,
): RoleSeparationOfDutyRule[] {
	return rules.filter((rule: RoleSeparationOfDutyRule): boolean => effectiveRoleNames.has(rule.roleA) && effectiveRoleNames.has(rule.roleB));
}

/** @throws SeparationOfDutyViolationError naming every violated rule. */
export function assertSeparationOfDuties(effectiveRoleNames: ReadonlySet<string>, rules: readonly RoleSeparationOfDutyRule[] = ROLE_SEPARATION_OF_DUTY_RULES): void {
	const violations: RoleSeparationOfDutyRule[] = findSeparationOfDutyViolations(effectiveRoleNames, rules);
	if (violations.length > 0) {
		throw new SeparationOfDutyViolationError(violations.map((rule: RoleSeparationOfDutyRule): string => `"${rule.roleA}" conflicts with "${rule.roleB}": ${rule.reason}`));
	}
}
