import {
	MERCHANT_BUSINESS_CATEGORY_LABELS,
	UNCATEGORISED_MERCHANT_CATEGORY_LABEL,
	type AdminSalesAnalyticsResponse,
	type MerchantBusinessCategory,
	type SalesSummary,
} from "@workspace/shared";
import { formatMinorUnits, MONEY_DISPLAY_LOCALE } from "@workspace/ui/lib/format/money";

/** One decimal on shares ("42.5%"). */
const SHARE_FRACTION_DIGITS = 1;

const SHARE_FORMATTER = new Intl.NumberFormat(MONEY_DISPLAY_LOCALE, { style: "percent", maximumFractionDigits: SHARE_FRACTION_DIGITS });

/** A top-merchants table row, ready to render. */
export interface TopMerchantRow {
	readonly organizationId: string;
	readonly name: string;
	readonly categoryLabel: string;
	readonly sales: string;
	readonly bills: string;
	readonly share: string;
}

/** True when the period has at least one paid bill. */
export function hasSalesInPeriod(sales: SalesSummary): boolean {
	return sales.bills.value > 0;
}

export function merchantCategoryLabel(category: MerchantBusinessCategory | null): string {
	return category === null ? UNCATEGORISED_MERCHANT_CATEGORY_LABEL : MERCHANT_BUSINESS_CATEGORY_LABELS[category];
}

/** `part` as a share of `total` ("42.5%"); `0%` when the total is zero. */
export function formatShareOfTotal(part: number, total: number): string {
	return SHARE_FORMATTER.format(total === 0 ? 0 : part / total);
}

/** The response's top merchants as display rows — money in the response currency, share of the platform total. */
export function toTopMerchantRows(response: AdminSalesAnalyticsResponse): readonly TopMerchantRow[] {
	const { currency, totalSalesMinor } = response.sales;
	return response.topMerchants.map((merchant) => ({
		organizationId: merchant.organizationId,
		name: merchant.name,
		categoryLabel: merchantCategoryLabel(merchant.category),
		sales: formatMinorUnits(merchant.salesMinor, currency),
		bills: merchant.bills.toLocaleString(MONEY_DISPLAY_LOCALE),
		share: formatShareOfTotal(merchant.salesMinor, totalSalesMinor.value),
	}));
}
