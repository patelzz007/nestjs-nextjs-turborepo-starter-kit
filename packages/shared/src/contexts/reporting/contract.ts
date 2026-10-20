// API contract leaves owned by the `reporting` context (plan §7: the backend owner of each
// endpoint). Composed into `apiContract` (`src/contracts/index.ts`) with identical keys.

import { z } from "zod";

import { defineContract, defineFileContract } from "../../contracts/define-contract";
import { fileResponse, singleResponse } from "../../contracts/response";
import { TenantSlugParamSchema } from "../tenancy/schemas/tenant";
import { claimsAnalyticsRoutes, integrationAnalyticsRoutes, tenantAnalyticsRoutes, rewardsAdminAnalyticsRoutes } from "./routes";
import {
	AdminSalesAnalyticsQuerySchema,
	AdminSalesAnalyticsResponseSchema,
	MerchantAnalyticsResponseSchema,
	RewardsAnalyticsQuerySchema,
	UserRewardsAnalyticsResponseSchema,
} from "./schemas/analytics";
import {
	AdminAnalyticsDashboardQuerySchema,
	AdminAnalyticsDashboardSchema,
	CustomerAnalyticsDashboardQuerySchema,
	CustomerAnalyticsDashboardSchema,
	MerchantAnalyticsDashboardQuerySchema,
	MerchantAnalyticsDashboardSchema,
} from "./schemas/analytics-dashboard";
import { ANALYTICS_EXPORT_CONTENT_TYPES, AdminAnalyticsExportQuerySchema, MerchantAnalyticsExportQuerySchema } from "./schemas/analytics-export";

/** Contract leaves composed into `apiContract.rewardsAdmin` (salesAnalytics, analyticsDashboard, analyticsExport). */
export const rewardsAdminAnalyticsContract = {
	salesAnalytics: defineContract({
		method: "GET",
		path: rewardsAdminAnalyticsRoutes.salesAnalytics,
		input: AdminSalesAnalyticsQuerySchema,
		response: singleResponse(AdminSalesAnalyticsResponseSchema),
	}),
	/** The platform dashboard: custom range + interval, series, top merchants, categories, cities, new vs returning customers. */
	analyticsDashboard: defineContract({
		method: "GET",
		path: rewardsAdminAnalyticsRoutes.analyticsDashboard,
		input: AdminAnalyticsDashboardQuerySchema,
		response: singleResponse(AdminAnalyticsDashboardSchema),
	}),
	/** The platform report as a file (`format`: csv | xlsx | pdf) — fetch it with `fetchDownload`. */
	analyticsExport: defineFileContract({
		method: "GET",
		path: rewardsAdminAnalyticsRoutes.analyticsExport,
		input: AdminAnalyticsExportQuerySchema,
		response: fileResponse(Object.values(ANALYTICS_EXPORT_CONTENT_TYPES)),
	}),
};

/** Contract leaves composed into `apiContract.claims` (analytics, analyticsDashboard). */
export const claimsAnalyticsContract = {
	analytics: defineContract({
		method: "GET",
		path: claimsAnalyticsRoutes.analytics,
		input: RewardsAnalyticsQuerySchema,
		response: singleResponse(UserRewardsAnalyticsResponseSchema),
	}),
	/** The customer's dashboard: custom range + interval, series, spending by category / merchant over time. */
	analyticsDashboard: defineContract({
		method: "GET",
		path: claimsAnalyticsRoutes.analyticsDashboard,
		input: CustomerAnalyticsDashboardQuerySchema,
		response: singleResponse(CustomerAnalyticsDashboardSchema),
	}),
};

/** Contract leaves composed into `apiContract.tenants` (analytics, analyticsDashboard, analyticsExport). */
/** Contract leaves composed into `apiContract.integration`: `tenants.analytics*` for an integration API key (tenant from the key). */
export const integrationAnalyticsContract = {
	analytics: defineContract({
		method: "GET",
		path: integrationAnalyticsRoutes.analytics,
		input: RewardsAnalyticsQuerySchema,
		response: singleResponse(MerchantAnalyticsResponseSchema),
	}),
	analyticsDashboard: defineContract({
		method: "GET",
		path: integrationAnalyticsRoutes.analyticsDashboard,
		input: MerchantAnalyticsDashboardQuerySchema,
		response: singleResponse(MerchantAnalyticsDashboardSchema),
	}),
	analyticsExport: defineFileContract({
		method: "GET",
		path: integrationAnalyticsRoutes.analyticsExport,
		input: MerchantAnalyticsExportQuerySchema,
		response: fileResponse(Object.values(ANALYTICS_EXPORT_CONTENT_TYPES)),
	}),
};

export const tenantAnalyticsContract = {
	analytics: defineContract({
		method: "GET",
		path: tenantAnalyticsRoutes.analytics,
		input: z.intersection(TenantSlugParamSchema, RewardsAnalyticsQuerySchema),
		response: singleResponse(MerchantAnalyticsResponseSchema),
	}),
	/** The merchant dashboard: custom range + interval, series, store / reward / redemption-method breakdowns. */
	analyticsDashboard: defineContract({
		method: "GET",
		path: tenantAnalyticsRoutes.analyticsDashboard,
		input: z.intersection(TenantSlugParamSchema, MerchantAnalyticsDashboardQuerySchema),
		response: singleResponse(MerchantAnalyticsDashboardSchema),
	}),
	/** The merchant report as a file (`format`: csv | xlsx | pdf) — fetch it with `fetchDownload`. */
	analyticsExport: defineFileContract({
		method: "GET",
		path: tenantAnalyticsRoutes.analyticsExport,
		input: z.intersection(TenantSlugParamSchema, MerchantAnalyticsExportQuerySchema),
		response: fileResponse(Object.values(ANALYTICS_EXPORT_CONTENT_TYPES)),
	}),
};
