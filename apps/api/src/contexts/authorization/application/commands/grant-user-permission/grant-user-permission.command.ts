import { Command } from "@nestjs/cqrs";
import type { EpochMs } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { PermissionOverrideEffect } from "../../../domain/aggregates/user-authorization.aggregate";

export interface GrantUserPermissionInput {
	readonly userId: string;
	readonly permissionId: string;
	readonly effect: PermissionOverrideEffect;
	/** `undefined` keeps an existing expiry on re-grant (none for a new grant). */
	readonly expiresAt: EpochMs | undefined;
}

/** Grant a direct ALLOW, or set a DENY override, for another user. */
export class GrantUserPermissionCommand extends Command<void> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: GrantUserPermissionInput,
	) {
		super();
	}
}
