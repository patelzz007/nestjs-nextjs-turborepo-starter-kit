import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";

import { PAYMENTS_SERVICE } from "../../payments.tokens";
import type { PaymentsService, ReconciliationRun } from "../../services/payments.service";
import { ReconcilePaymentsCommand } from "./reconcile-payments.command";

@CommandHandler(ReconcilePaymentsCommand)
export class ReconcilePaymentsHandler implements ICommandHandler<ReconcilePaymentsCommand, ReconciliationRun> {
	public constructor(@Inject(PAYMENTS_SERVICE) private readonly payments: PaymentsService) {}

	public execute(command: ReconcilePaymentsCommand): Promise<ReconciliationRun> {
		return this.payments.reconcile(command.actor);
	}
}
