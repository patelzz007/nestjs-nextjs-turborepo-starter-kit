import { DomainError } from "../../../../platform/domain/errors/domain-error";
import type { DomainErrorCode } from "../../../../platform/domain/errors/error-codes";

/** A request reached a feature that is off for its caller (`@RequireFeatureFlag`, or a context's own check). */
export class FeatureUnavailableError extends DomainError {
	public readonly code: DomainErrorCode = "FEATURE_UNAVAILABLE";

	public constructor(public readonly key: string) {
		super("This feature isn't available right now.", { key });
	}
}

/** The user, location or tenant an override or a listed group names doesn't exist. */
export class FlagSubjectNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "FEATURE_FLAG_SUBJECT_NOT_FOUND";

	public constructor(
		public readonly unit: string,
		public readonly subjectId: string,
	) {
		super("That user, location or tenant was not found.", { unit, subjectId });
	}
}

/** No live flag override with that id for this flag. */
export class FlagOverrideNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "FEATURE_FLAG_OVERRIDE_NOT_FOUND";

	public constructor(public readonly overrideId: string) {
		super("That override was not found.", { overrideId });
	}
}

/** The rules changed since the editor loaded them: saving would silently undo someone else's change. */
export class FlagRevisionConflictError extends DomainError {
	public readonly code: DomainErrorCode = "FEATURE_FLAG_REVISION_CONFLICT";

	public constructor(
		public readonly key: string,
		public readonly basedOn: number | null,
		public readonly live: number | null,
	) {
		super("Someone changed these rules after you opened them. Reload to see their change, then try again.", { key, basedOn, live });
	}
}

export class FlagRevisionNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "FEATURE_FLAG_REVISION_NOT_FOUND";

	public constructor(
		public readonly key: string,
		public readonly revision: number,
	) {
		super("That revision was not found.", { key, revision });
	}
}

/** Only a pending revision can be approved or rejected (it may have expired or been decided already). */
export class FlagRevisionNotPendingError extends DomainError {
	public readonly code: DomainErrorCode = "FEATURE_FLAG_REVISION_NOT_PENDING";

	public constructor(
		public readonly key: string,
		public readonly revision: number,
	) {
		super("That revision isn't waiting for a decision any more.", { key, revision });
	}
}

/** Nobody approves or rejects their own pending revision, superadmins included. */
export class FlagSelfApprovalError extends DomainError {
	public readonly code: DomainErrorCode = "FEATURE_FLAG_SELF_APPROVAL";

	public constructor(public readonly key: string) {
		super("Someone other than its author has to decide this change.", { key });
	}
}

/** The rules or values name something that doesn't exist or can't be used here. */
export class FlagRulesInvalidError extends DomainError {
	public readonly code: DomainErrorCode = "FEATURE_FLAG_RULES_INVALID";

	public constructor(
		public readonly key: string,
		problem: string,
	) {
		super(problem, { key });
	}
}

export class FlagGroupNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "FLAG_GROUP_NOT_FOUND";

	public constructor(public readonly groupId: string) {
		super("That flag group was not found.", { groupId });
	}
}

export class FlagGroupKeyTakenError extends DomainError {
	public readonly code: DomainErrorCode = "FLAG_GROUP_KEY_TAKEN";

	public constructor(public readonly key: string) {
		super("A flag group with that key already exists.", { key });
	}
}

/** A group a live or pending rule names can't be removed. */
export class FlagGroupInUseError extends DomainError {
	public readonly code: DomainErrorCode = "FLAG_GROUP_IN_USE";

	public constructor(
		public readonly key: string,
		usedBy: string,
	) {
		super(`Rules still name this group: ${usedBy}. Remove it from them first.`, { key, usedBy });
	}
}

/** A change that doesn't fit the group: conditions on a listed group, too many members, the wrong kind of id. */
export class FlagGroupInvalidError extends DomainError {
	public readonly code: DomainErrorCode = "FLAG_GROUP_INVALID";

	public constructor(
		public readonly key: string,
		problem: string,
	) {
		super(problem, { key });
	}
}

export class ExperimentNotFoundError extends DomainError {
	public readonly code: DomainErrorCode = "EXPERIMENT_NOT_FOUND";

	public constructor(public readonly experimentId: string) {
		super("That experiment was not found.", { experimentId });
	}
}

export class ExperimentKeyTakenError extends DomainError {
	public readonly code: DomainErrorCode = "EXPERIMENT_KEY_TAKEN";

	public constructor(public readonly key: string) {
		super("An experiment with that key already exists.", { key });
	}
}

/** Only a draft can be changed or started, and only a running experiment stopped. */
export class ExperimentStateError extends DomainError {
	public readonly code: DomainErrorCode = "EXPERIMENT_STATE_INVALID";

	public constructor(
		public readonly experimentId: string,
		public readonly status: string,
	) {
		super(`This experiment is ${status.toLowerCase()}; that can't be done now.`, { experimentId, status });
	}
}

/** One running experiment per dynamic config. */
export class ExperimentConfigBusyError extends DomainError {
	public readonly code: DomainErrorCode = "EXPERIMENT_CONFIG_BUSY";

	public constructor(public readonly configKey: string) {
		super("Another experiment is already running on this config.", { configKey });
	}
}

/** The variants name values the config's live revision doesn't have. */
export class ExperimentPlanInvalidError extends DomainError {
	public readonly code: DomainErrorCode = "EXPERIMENT_PLAN_INVALID";

	public constructor(
		public readonly experimentId: string,
		problem: string,
	) {
		super(problem, { experimentId });
	}
}

/** A promotion file that can't be imported here as it is. */
export class PromotionInvalidError extends DomainError {
	public readonly code: DomainErrorCode = "PROMOTION_INVALID";

	public constructor(
		public readonly key: string,
		problem: string,
	) {
		super(problem, { key });
	}
}
