import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { SystemCommandDispatcher } from "../../../../platform/application/system-command-dispatcher";
import { ExpireSupportAccessGrantsCommand } from "../../application/commands/expire-support-access-grants/expire-support-access-grants.command";
import { SUPPORT_ACCESS_EXPIRY_OPERATION } from "../../application/ports/authorization.tokens";
import { authorizationSystemActor } from "../../application/services/rbac-actor";

/**
 * Every 5 minutes: support access grants past their expiry become EXPIRED (an audited system command;
 * a failure is audited and rethrown). Overlapping runs on several replicas are safe: due rows are
 * locked with `SKIP LOCKED` and written compare-and-set.
 */
@Injectable()
export class SupportAccessExpiryCron {
	private readonly logger: Logger = new Logger(SupportAccessExpiryCron.name);

	public constructor(private readonly dispatcher: SystemCommandDispatcher) {}

	@Cron(CronExpression.EVERY_5_MINUTES)
	public async expireGrants(): Promise<void> {
		const actor = authorizationSystemActor(SUPPORT_ACCESS_EXPIRY_OPERATION, "cron", "Expire support access grants past their expiry");
		const result = await this.dispatcher.dispatch(new ExpireSupportAccessGrantsCommand(actor), { kind: "cron", name: "support-access-expiry" });
		if (result.expired > 0) {
			this.logger.log({ event: "support_access.expired", expired: result.expired });
		}
	}
}
