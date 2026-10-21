import { Command } from "@nestjs/cqrs";

import type { SystemActor } from "../../services/rbac-mutation-scope";

/** What one expiry run ended. */
export interface SupportAccessExpiryResult {
	readonly expired: number;
	readonly grantIds: readonly string[];
}

/** The support-access expiry job: every non-terminal grant past `expiresAt` becomes EXPIRED. */
export class ExpireSupportAccessGrantsCommand extends Command<SupportAccessExpiryResult> {
	public constructor(public readonly actor: SystemActor) {
		super();
	}
}
