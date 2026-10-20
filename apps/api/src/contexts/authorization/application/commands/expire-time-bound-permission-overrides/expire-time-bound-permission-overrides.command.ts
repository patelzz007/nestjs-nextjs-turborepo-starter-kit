import { Command } from "@nestjs/cqrs";

import type { SystemActor } from "../../services/rbac-mutation-scope";

/** Retire every direct override (ALLOW or DENY) past its expiry. @returns how many were retired. */
export class ExpireTimeBoundPermissionOverridesCommand extends Command<number> {
	public constructor(public readonly actor: SystemActor) {
		super();
	}
}
