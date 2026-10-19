import type { EpochMs, SaleCurrency } from "@workspace/shared";

import { DomainEvent } from "../../../../platform/domain/domain-event";

/** A paid bill was recorded with the rewards redeemed on it (the analytics `merchant.redeem_reward` event). */
export class SaleCheckedOut extends DomainEvent {
	public readonly eventName = "pos.SaleCheckedOut";

	public constructor(
		occurredAt: EpochMs,
		public readonly saleId: string,
		public readonly organizationId: string,
		public readonly customerUserId: string,
		public readonly locationId: string | null,
		public readonly terminalId: string,
		public readonly billTotalMinor: number,
		public readonly currency: SaleCurrency,
		public readonly claimIds: readonly string[],
	) {
		super(occurredAt);
	}
}

export type PosEvent = SaleCheckedOut;
