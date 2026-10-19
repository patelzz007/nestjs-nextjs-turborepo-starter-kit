import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import type { EpochMs, RedemptionCheckoutInput, RedemptionCheckoutResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { CLOCK, type Clock } from "../../../../../platform/application/clock.port";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { ClaimNoLongerRedeemableError } from "../../../../claims/public-api";
import { RewardSale, type CheckoutPoint, type SaleLine } from "../../../domain/aggregates/reward-sale.aggregate";
import { PosCodeLockedError, RedemptionCodeNotFoundError, SaleIdempotencyKeyTakenError } from "../../../domain/errors/pos.errors";
import type { StoredSale } from "../../../domain/repositories/pos.repositories";
import { idempotencyKeyTakenElsewhere, redemptionRefused, toPosWireError } from "../../errors/pos-refusal.errors";
import type { PosScope } from "../../pos-scope";
import type { CheckoutFingerprintPort } from "../../ports/checkout-fingerprint.port";
import { CHECKOUT_FINGERPRINT, POS_ID_GENERATOR, POS_UNIT_OF_WORK, type PosIdGenerator } from "../../ports/pos.tokens";
import { RedemptionCodeResolver, type CodeResolution } from "../../services/redemption-code-resolver";
import { CheckoutSaleCommand } from "./checkout-sale.command";

type CheckoutOutcome = Exclude<CodeResolution, { readonly kind: "resolved" }> | { readonly kind: "recorded"; readonly response: RedemptionCheckoutResponse };

/** A stored redemption whose claim or reward does not exist at all (both are soft-deleted, never removed): corrupt data. */
export class SaleRedemptionUnresolvedError extends Error {
	public constructor(saleId: string, claimId: string) {
		super(`Sale ${saleId} redeemed claim ${claimId}, whose claim or reward does not exist`);
		this.name = "SaleRedemptionUnresolvedError";
	}
}

/**
 * Records a paid bill and redeems every presented reward in ONE unit of work, all-or-nothing and
 * idempotent (plan §7.3): the claims' compare-and-set redemption in claim-id order, then every reward
 * the sale can touch (the redeemed rewards AND their referrer children) locked in ONE id-ordered pass,
 * so overlapping checkouts never lock two rewards in opposite orders; then the redemption counters, the sale and
 * its redemption rows, the audit row, the referrer credits and the signup-referral success stamp.
 * `SaleCheckedOut` feeds the analytics outbox in the same transaction; the credited referrers' claims
 * and notices follow from `ReferrerCredited` in it too.
 *
 * A retried idempotency key replays the stored sale (only for the identical request). A concurrent
 * request with the same key, or a claim a concurrent checkout redeemed first, rolls this one back and
 * replays the winner when there is one; a winner the caller cannot read (another store's sale under the
 * organization-wide key) is answered 409 `IDEMPOTENCY_KEY_REUSED`.
 */
@CommandHandler(CheckoutSaleCommand)
export class CheckoutSaleHandler implements ICommandHandler<CheckoutSaleCommand, RedemptionCheckoutResponse> {
	public constructor(
		@Inject(POS_UNIT_OF_WORK) private readonly uow: UnitOfWork<PosScope>,
		private readonly resolver: RedemptionCodeResolver,
		@Inject(POS_ID_GENERATOR) private readonly ids: PosIdGenerator,
		@Inject(CHECKOUT_FINGERPRINT) private readonly fingerprint: CheckoutFingerprintPort,
		@Inject(CLOCK) private readonly clock: Clock,
	) {}

	public async execute(command: CheckoutSaleCommand): Promise<RedemptionCheckoutResponse> {
		const { actor, point, input } = command;
		const requestHash = this.fingerprint.of(input);
		try {
			const replayed = await this.replay(actor, point, input.idempotencyKey, requestHash);
			if (replayed !== null) {
				return replayed;
			}
			const outcome = await this.uow.run(actor, async (scope: PosScope): Promise<CheckoutOutcome> => this.checkout(scope, point, input, requestHash));
			switch (outcome.kind) {
				case "locked":
					throw new PosCodeLockedError(outcome.lockedUntil);
				case "not_found":
					throw new RedemptionCodeNotFoundError();
				case "recorded":
					return outcome.response;
			}
		} catch (error) {
			if (error instanceof SaleIdempotencyKeyTakenError || error instanceof ClaimNoLongerRedeemableError) {
				return this.replayWinner(actor, point, input.idempotencyKey, requestHash, error);
			}
			throw error instanceof Error ? toPosWireError(error) : error;
		}
	}

	private async checkout(scope: PosScope, point: CheckoutPoint, input: RedemptionCheckoutInput, requestHash: string): Promise<CheckoutOutcome> {
		const now = this.clock.now();
		const resolution = await this.resolver.resolve(scope, point, input.codes, now);
		if (resolution.kind !== "resolved") {
			return resolution;
		}
		const sale = RewardSale.checkout(
			{
				id: this.ids.next(),
				point,
				billTotalMinor: input.billTotalMinor,
				currency: input.currency,
				idempotencyKey: input.idempotencyKey,
				requestHash,
				presented: resolution.codes,
			},
			now,
		);
		const { lines, customerUserId } = sale.snapshot();
		await scope.claims.redeem(
			lines.map((line: SaleLine): string => line.claimId),
			now,
		);
		await scope.rewards.lockForCheckout(lines.map((line: SaleLine): string => line.rewardId));
		for (const line of [...lines].sort((left: SaleLine, right: SaleLine): number => left.rewardId.localeCompare(right.rewardId))) {
			await scope.rewards.recordRedemption(line.rewardId, now);
		}
		const stored = await scope.sales.add(sale);
		await scope.rewardAudit.append({
			organizationId: point.organizationId,
			actorUserId: null,
			action: "merchant.checkout",
			metadata: {
				saleId: sale.id,
				claimIds: lines.map((line: SaleLine): string => line.claimId),
				terminalId: point.terminalId,
				apiKeyId: point.apiKeyId,
				locationId: point.locationId,
				billTotalMinor: input.billTotalMinor,
				currency: input.currency,
			},
		});
		await this.creditReferrals(scope, lines, customerUserId, now);
		scope.events.collectFrom(sale);
		return { kind: "recorded", response: await this.respond(scope, stored) };
	}

	/** The referrer of every redeemed claim that was referred, then the customer's signup referral on their first redemption (ADR 035). */
	private async creditReferrals(scope: PosScope, lines: readonly SaleLine[], customerUserId: string, now: EpochMs): Promise<void> {
		for (const line of lines) {
			await scope.referrals.creditReferrer(line.rewardId, customerUserId, now);
		}
		await scope.referrals.markSignupReferralSuccessful(customerUserId, now);
	}

	/** The stored sale under this key, replayed for the identical request; null when there is none. */
	private async replay(actor: ActorContext, point: CheckoutPoint, idempotencyKey: string, requestHash: string): Promise<RedemptionCheckoutResponse | null> {
		return this.uow.run(actor, async (scope: PosScope): Promise<RedemptionCheckoutResponse | null> => {
			const stored = await scope.sales.findByIdempotencyKey(point.organizationId, idempotencyKey);
			if (stored === null) {
				return null;
			}
			RewardSale.assertReplayOf({ saleId: stored.id, requestHash: stored.requestHash }, requestHash);
			return this.respond(scope, stored);
		});
	}

	/** A concurrent checkout won the race: replay its sale, or answer the claim it redeemed first as already redeemed. */
	private async replayWinner(
		actor: ActorContext,
		point: CheckoutPoint,
		idempotencyKey: string,
		requestHash: string,
		lost: SaleIdempotencyKeyTakenError | ClaimNoLongerRedeemableError,
	): Promise<RedemptionCheckoutResponse> {
		try {
			const winner = await this.replay(actor, point, idempotencyKey, requestHash);
			if (winner !== null) {
				return winner;
			}
		} catch (error) {
			throw error instanceof Error ? toPosWireError(error) : error;
		}
		throw lost instanceof ClaimNoLongerRedeemableError ? redemptionRefused("ALREADY_REDEEMED", lost.claimId) : idempotencyKeyTakenElsewhere();
	}

	private async respond(scope: PosScope, sale: StoredSale): Promise<RedemptionCheckoutResponse> {
		const rewardIds = await scope.claims.rewardIdsOf(sale.lines.map((line) => line.claimId));
		const titles = await scope.rewardFacts.titlesOf([...rewardIds.values()]);
		return {
			saleId: sale.id,
			billTotalMinor: sale.billTotalMinor,
			currency: sale.currency,
			paidAt: sale.paidAt,
			idempotencyKey: sale.idempotencyKey,
			redemptions: sale.lines.map((line) => {
				const rewardId = rewardIds.get(line.claimId);
				const rewardTitle = rewardId === undefined ? undefined : titles.get(rewardId);
				if (rewardId === undefined || rewardTitle === undefined) {
					throw new SaleRedemptionUnresolvedError(sale.id, line.claimId);
				}
				return { redemptionId: line.redemptionId, claimId: line.claimId, rewardId, rewardTitle };
			}),
		};
	}
}
