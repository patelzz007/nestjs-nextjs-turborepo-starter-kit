// The after-commit evaluation (ADR 085) on the real command bus: pos's `SaleCheckedOut` → the dispatcher → the real
// `EvaluateCustomerTierHandler`. Only the evaluator and the flag are fakes.

import { CqrsModule } from "@nestjs/cqrs";
import { Test } from "@nestjs/testing";
import { epochMs, type EpochMs } from "@workspace/shared";
import { describe, expect, it, vi } from "vitest";

import { RECORDING_COMMAND_DISPATCHER, RecordingCommandDispatcher } from "../../../../e2e/support/recording-command-dispatcher";
import { SaleCheckedOut } from "../../pos/public-api";
import { SwitchableTiersAvailability } from "../application/__tests__/fakes/tier-reads.fakes";
import { EvaluateCustomerTierCommand } from "../application/commands/evaluate-customer-tier/evaluate-customer-tier.command";
import { EvaluateCustomerTierHandler } from "../application/commands/evaluate-customer-tier/evaluate-customer-tier.handler";
import { EvaluateTierAfterSale } from "../application/event-handlers/after-commit/evaluate-tier-after-sale.event-handler";
import { TIER_EVALUATOR, TIER_STANDING_EVALUATE_OPERATION, TIERS_AVAILABILITY } from "../application/ports/tiers.tokens";
import type { TierEvaluator } from "../application/services/tier-evaluator";

const NOW: EpochMs = epochMs(1_800_000_000_000);
const CUSTOMER = "0193f2c4-0000-7000-8000-0000000000a1";
const CAFE = "0193f2c4-0000-7000-8000-00000000c001";
const SALE = new SaleCheckedOut(NOW, "0193f2c4-0000-7000-8000-0000000000e1", CAFE, CUSTOMER, null, "till-1", 1_500, "MYR", []);

/** The real command bus with the real handler over `evaluate`, and a dispatcher that records what it was given. */
async function handlerWith(evaluate: TierEvaluator["evaluate"]): Promise<{ readonly handler: EvaluateTierAfterSale; readonly dispatcher: RecordingCommandDispatcher }> {
	const moduleRef = await Test.createTestingModule({
		imports: [CqrsModule.forRoot()],
		providers: [
			RECORDING_COMMAND_DISPATCHER,
			EvaluateCustomerTierHandler,
			{ provide: TIERS_AVAILABILITY, useValue: new SwitchableTiersAvailability() },
			{ provide: TIER_EVALUATOR, useValue: { evaluate } },
		],
	}).compile();
	await moduleRef.init();
	const dispatcher = moduleRef.get(RecordingCommandDispatcher);
	return { handler: new EvaluateTierAfterSale(dispatcher), dispatcher };
}

describe("EvaluateTierAfterSale", () => {
	it("re-evaluates the sale's customer through the dispatcher, as a consumer trigger", async () => {
		const evaluate = vi.fn<TierEvaluator["evaluate"]>(() => Promise.resolve("SILVER"));
		const { handler, dispatcher } = await handlerWith(evaluate);
		await handler.handle(SALE);

		const [dispatched] = dispatcher.dispatched;
		expect(dispatched?.origin).toStrictEqual({ kind: "consumer", name: "EvaluateTierAfterSale.handle" });
		expect(dispatched?.command).toBeInstanceOf(EvaluateCustomerTierCommand);
		expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({ kind: "system", operation: TIER_STANDING_EVALUATE_OPERATION }), CUSTOMER, "redemption");
	});

	it("never fails the checkout: a failed evaluation is only logged (the nightly review makes it up)", async () => {
		const { handler, dispatcher } = await handlerWith(() => Promise.reject(new Error("db down")));
		await expect(handler.handle(SALE)).resolves.toBeUndefined();
		expect(dispatcher.dispatched).toHaveLength(1);
	});
});
