import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { ACCOUNT_ERASURE_SERVICE } from "../../ports/account-erasure.store";
import type { AccountErasureService, ErasureRun } from "../../services/account-erasure.service";
import { CompleteDueErasuresCommand } from "./complete-due-erasures.command";

@CommandHandler(CompleteDueErasuresCommand)
export class CompleteDueErasuresHandler implements ICommandHandler<CompleteDueErasuresCommand, ErasureRun> {
	public constructor(@Inject(ACCOUNT_ERASURE_SERVICE) private readonly erasures: AccountErasureService) {}

	public execute(command: CompleteDueErasuresCommand): Promise<ErasureRun> {
		return this.erasures.completeDue(command.actor);
	}
}
