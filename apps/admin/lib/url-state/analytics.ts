import { defineUrlState, urlParamWithDefault } from "@workspace/client/lib/url-state/url-state";

import { DEFAULT_SALES_PERIOD_WEEKS, SalesPeriodWeeksParamSchema } from "@/lib/analytics/sales-period";
import { SALES_PERIOD_WEEKS_PARAM } from "@/lib/routes";

/**
 * `/analytics/sales` state: `?weeks=4|8|12`, a shareable filter. Anything
 * else (absent, repeated, not a preset) reads as the default, which is left
 * out of the URL.
 */
export const SALES_ANALYTICS_URL_STATE = defineUrlState(
	{ weeks: urlParamWithDefault(SalesPeriodWeeksParamSchema, DEFAULT_SALES_PERIOD_WEEKS) },
	{ urlKeys: { weeks: SALES_PERIOD_WEEKS_PARAM } },
);

export type SalesAnalyticsUrlState = typeof SALES_ANALYTICS_URL_STATE.defaults;
