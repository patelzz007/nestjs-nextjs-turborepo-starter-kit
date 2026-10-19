import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { SystemCommandDispatcher } from "../../../../platform/application/system-command-dispatcher";
import { ExpireTimeBoundPermissionOverridesCommand } from "../../application/commands/expire-time-bound-permission-overrides/expire-time-bound-permission-overrides.command";
import { PERMISSION_EXPIRY_OPERATION } from "../../application/ports/authorization.tokens";
import { authorizationSystemActor } from "../../application/services/rbac-actor";

/** Hourly: retire time-bound direct overrides past their expiry (audited system command; a failure is audited and rethrown). */
@Injectable()
export class PermissionExpiryCron {
	private readonly logger: Logger = new Logger(PermissionExpiryCron.name);

	public constructor(private readonly dispatcher: SystemCommandDispatcher) {}

	@Cron(CronExpression.EVERY_HOUR)
	public async expireOverrides(): Promise<void> {
		const actor = authorizationSystemActor(PERMISSION_EXPIRY_OPERATION, "cron", "Expire time-bound direct permission overrides");
		const expired: number = await this.dispatcher.dispatch(new ExpireTimeBoundPermissionOverridesCommand(actor), { kind: "cron", name: "permission-expiry" });
		if (expired > 0) {
			this.logger.log(`Expired ${String(expired)} direct permission override(s)`);
		}
	}
}
