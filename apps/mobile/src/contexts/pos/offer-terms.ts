// What a scanned reward gives, in the till's words (ADR 074): one line for the offer ("15% off the
// bill", "1 × Latte (12 oz) free") and the rows a cashier needs to apply it — the item and its SKU
// for a free item or buy one, get one, so the POS can ring the right product up at no charge.

import { PLATFORM_DISPLAY_REGION, type RedemptionOffer } from "@workspace/shared";
import type { DetailItem } from "@workspace/ui-native/components/detail-list";

import { formatBillAmount } from "./bill-amount";
import { TILL_COPY } from "./labels";

function formatCount(count: number): string {
	return new Intl.NumberFormat(PLATFORM_DISPLAY_REGION.locale).format(count);
}

/** The offer in one line, as the cashier applies it. */
export function describeOffer(offer: RedemptionOffer): string {
	switch (offer.type) {
		case "DISCOUNT":
			return TILL_COPY.offerDiscount(formatCount(offer.percentOff));
		case "CASHBACK":
			return TILL_COPY.offerCashback(formatBillAmount(offer.amountMinor, offer.currency));
		case "POINTS":
			return TILL_COPY.offerPoints(formatCount(offer.points));
		case "FREE_ITEM":
			return TILL_COPY.offerFreeItem(formatCount(offer.quantity), offer.item.name);
		case "BOGO":
			return TILL_COPY.offerBogo(offer.item.name, formatCount(offer.freeQuantity));
	}
}

/** The offer's rows: the line, then the item and its SKU when it gives one. */
export function offerDetails(offer: RedemptionOffer): DetailItem[] {
	const details: DetailItem[] = [{ label: TILL_COPY.offerLabel, value: describeOffer(offer) }];
	switch (offer.type) {
		case "FREE_ITEM":
		case "BOGO":
			details.push({ label: TILL_COPY.itemLabel, value: offer.item.name }, { label: TILL_COPY.skuLabel, value: offer.item.sku });
			return details;
		case "DISCOUNT":
		case "CASHBACK":
		case "POINTS":
			return details;
	}
}
