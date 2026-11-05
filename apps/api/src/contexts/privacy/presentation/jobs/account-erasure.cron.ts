import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { systemActor } from "../../../../platform/application/actor-context";
import { ACCOUNT_ERASE_OPERATION } from "../../../../platform/application/personal-data/personal-data-erasure.registry";
import { SystemCommandDispatcher } from "../../../../platform/application/system-command-dispatcher";
import { CompleteDueErasuresCommand } from "../../application/commands/complete-due-erasures/complete-due-erasures.command";

/** Every hour: carry out account erasures whose 30-day grace period has ended (ADR 077). */
@Injectable()
export class AccountErasureCron {
	private readonly logger: Logger = new Logger(AccountErasureCron.name);

	public constructor(private readonly dispatcher: SystemCommandDispatcher) {}

	@Cron(CronExpression.EVERY_HOUR)
	public async run(): Promise<void> {
		const actor = systemActor(ACCOUNT_ERASE_OPERATION, "cron", null, "Carry out account erasures past their grace period", null);
		const run = await this.dispatcher.dispatch(new CompleteDueErasuresCommand(actor), { kind: "cron", name: "account-erasure" });
		if (run.completed + run.failed + run.blocked > 0) {
			this.logger.log({ event: "privacy.erasure.run", ...run });
		}
	}
}
