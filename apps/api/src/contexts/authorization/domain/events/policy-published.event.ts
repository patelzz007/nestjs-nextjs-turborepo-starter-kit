import type { EpochMs } from "@workspace/shared";

import { DomainEvent } from "../../../../platform/domain/domain-event";

/**
 * A policy draft was published as a new version of its slot. After commit (mechanism 2) every instance
 * drops the compiled bundles the version made stale: one organization's bundle for a TENANT slot, every
 * bundle for a platform slot (a guardrail is part of every organization's bundle).
 */
export class PolicyPublished extends DomainEvent {
	public readonly eventName = "authorization.PolicyPublished";

	public constructor(
		occurredAt: EpochMs,
		public readonly draftId: string,
		/** `null` for a platform slot. */
		public readonly organizationId: string | null,
		public readonly version: number,
	) {
		super(occurredAt);
	}
}
