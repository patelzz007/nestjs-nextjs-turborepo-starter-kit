import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { BootstrapIdentity, BootstrapOutcome } from "./bootstrap-super-admin.types";

export interface BootstrapSuperAdminInput {
	readonly identity: BootstrapIdentity;
	/** Already validated by the CLI with signup's password policy; never logged or audited. */
	readonly password: string;
}

/** CLI: create the platform's first SuperAdmin (advisory lock + one-time check). */
export class BootstrapSuperAdminCommand extends Command<BootstrapOutcome> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: BootstrapSuperAdminInput,
	) {
		super();
	}
}
