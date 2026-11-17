import type { AppLanguage, ClientPlatform, CustomerTier, DeploymentEnvironment, FlagApp, PermissionReference, RolloutUnit } from "@workspace/shared";

/**
 * What the API knows about a subject's person, looked up only when a rule asks (`requiredFacts`). Null: not
 * looked up, or there is no person.
 */
export interface SubjectFacts {
	/** The lower-case part after `@` of the person's email. */
	readonly emailDomain: string | null;
	readonly platformStaff: boolean | null;
	readonly permissions: readonly PermissionReference[] | null;
	readonly customerTier: CustomerTier | null;
}

export const NO_FACTS: SubjectFacts = { emailDomain: null, platformStaff: null, permissions: null, customerTier: null };

/** Who a decision is for, and where: everything a condition or a percentage reads. */
export interface EvaluationSubject {
	readonly userId: string | null;
	readonly tenantId: string | null;
	readonly locationId: string | null;
	readonly deviceId: string | null;
	readonly app: FlagApp;
	readonly platform: ClientPlatform | null;
	readonly appVersion: string | null;
	readonly locale: AppLanguage | null;
	readonly environment: DeploymentEnvironment;
	/** Epoch milliseconds: time conditions and scheduled rollouts read it. */
	readonly now: number;
	readonly facts: SubjectFacts;
}

/** The same moment and place with no person, store or device: how a deployment-wide flag is decided. */
export function withoutSubject(subject: EvaluationSubject): EvaluationSubject {
	return { ...subject, userId: null, tenantId: null, locationId: null, deviceId: null, facts: NO_FACTS };
}

/** The subject's id for a rollout unit, or null when it has none (a signed-out visitor has no user). */
export function unitIdOf(subject: EvaluationSubject, unit: RolloutUnit): string | null {
	switch (unit) {
		case "USER":
			return subject.userId;
		case "TENANT":
			return subject.tenantId;
		case "LOCATION":
			return subject.locationId;
		case "DEVICE":
			return subject.deviceId;
	}
}
