import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { systemActor } from "../../../../platform/application/actor-context";
import { SystemCommandDispatcher } from "../../../../platform/application/system-command-dispatcher";
import { ReconcilePaymentsCommand } from "../../application/commands/reconcile-payments/reconcile-payments.command";
import { PAYMENT_RECONCILE_OPERATION } from "../../application/payments.tokens";

/** Every 10 minutes: ask the gateways about payments whose callback never came (ADR 020). */
@Injectable()
export class PaymentReconciliationCron {
	private readonly logger: Logger = new Logger(PaymentReconciliationCron.name);

	public constructor(private readonly dispatcher: SystemCommandDispatcher) {}

	@Cron(CronExpression.EVERY_10_MINUTES)
	public async reconcile(): Promise<void> {
		const actor = systemActor(PAYMENT_RECONCILE_OPERATION, "cron", null, "Ask payment gateways about payments still open", null);
		const run = await this.dispatcher.dispatch(new ReconcilePaymentsCommand(actor), { kind: "cron", name: "payment-reconciliation" });
		if (run.checked > 0) {
			this.logger.log({ event: "payments.reconciled", ...run });
		}
	}
}
