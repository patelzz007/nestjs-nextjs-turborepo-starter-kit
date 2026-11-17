import { compareAppVersions, type AppVersionOrder, type Condition, type ListOperator } from "@workspace/shared";

import type { CatalogIndex, IndexedGroup } from "../catalog/catalog-index";
import { unitIdOf, type EvaluationSubject } from "./evaluation-subject";

// ── Matching one condition ───────────────────────────────────────────────────────────────────────
// A condition about something the subject doesn't have (no person, no app version, no store, a group that
// no longer exists) never matches, whichever its operator: a missing fact is never read as "not in the list".

/** `compareAppVersions`' answer for two versions of the same precedence. */
const SAME_VERSION: AppVersionOrder = 0;

function inList<T>(operator: ListOperator, value: T | null, values: readonly T[]): boolean {
	if (value === null) {
		return false;
	}
	const found = values.includes(value);
	return operator === "IN" ? found : !found;
}

function isMemberOf(group: IndexedGroup, subject: EvaluationSubject, index: CatalogIndex): boolean {
	if (group.kind === "LIST") {
		const id = unitIdOf(subject, group.unit);
		return id !== null && group.members.has(id);
	}
	return group.conditions.every((condition) => matchesCondition(condition, subject, index));
}

function matchesAppVersion(operator: "AT_LEAST" | "BELOW", version: string, subject: EvaluationSubject): boolean {
	if (subject.appVersion === null) {
		return false;
	}
	const atLeast = compareAppVersions(subject.appVersion, version) >= SAME_VERSION;
	return operator === "AT_LEAST" ? atLeast : !atLeast;
}

/** Whether one condition holds for the subject. */
export function matchesCondition(condition: Condition, subject: EvaluationSubject, index: CatalogIndex): boolean {
	switch (condition.attribute) {
		case "USER_ID":
			return inList(condition.operator, subject.userId, condition.values);
		case "EMAIL_DOMAIN":
			return inList(condition.operator, subject.facts.emailDomain, condition.values);
		case "PLATFORM_STAFF":
			return subject.facts.platformStaff !== null && subject.facts.platformStaff === condition.is;
		case "PERMISSION": {
			const held = subject.facts.permissions;
			if (held === null) {
				return false;
			}
			const has = held.some((permission) => permission.action === condition.permission.action && permission.resource === condition.permission.resource);
			return condition.operator === "HAS" ? has : !has;
		}
		case "TENANT_ID":
			return inList(condition.operator, subject.tenantId, condition.values);
		case "LOCATION_ID":
			return inList(condition.operator, subject.locationId, condition.values);
		case "CUSTOMER_TIER":
			return inList(condition.operator, subject.facts.customerTier, condition.values);
		case "APP":
			return inList(condition.operator, subject.app, condition.values);
		case "PLATFORM":
			return inList(condition.operator, subject.platform, condition.values);
		case "APP_VERSION":
			return matchesAppVersion(condition.operator, condition.version, subject);
		case "LOCALE":
			return inList(condition.operator, subject.locale, condition.values);
		case "FLAG_GROUP": {
			const group = index.group(condition.groupKey);
			if (group === null) {
				return false;
			}
			const member = isMemberOf(group, subject, index);
			return condition.operator === "IN_GROUP" ? member : !member;
		}
		case "TIME":
			return (condition.from === null || condition.from <= subject.now) && (condition.until === null || subject.now < condition.until);
		case "ENVIRONMENT":
			return inList(condition.operator, subject.environment, condition.values);
	}
}
