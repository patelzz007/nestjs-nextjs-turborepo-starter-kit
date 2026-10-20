import { DAY_MS, epochMs, MERCHANT_CAPABILITY } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { captureFastifyRequest } from "../../../../../test/support/fastify-request";
import { selectedAnalyticsLocations } from "../../domain/value-objects/analytics-scope.value-object";
import { ExportMerchantReportHandler } from "../queries/export-merchant-report/export-merchant-report.handler";
import { ExportMerchantReportQuery } from "../queries/export-merchant-report/export-merchant-report.query";
import { GetMerchantAnalyticsHandler } from "../queries/get-merchant-analytics/get-merchant-analytics.handler";
import { GetMerchantAnalyticsQuery } from "../queries/get-merchant-analytics/get-merchant-analytics.query";
import { GetMerchantDashboardHandler } from "../queries/get-merchant-dashboard/get-merchant-dashboard.handler";
import { GetMerchantDashboardQuery } from "../queries/get-merchant-dashboard/get-merchant-dashboard.query";
import { apiKeyActor, userActor } from "./fakes/analytics-actors";
import { MerchantAccessDeniedForTest } from "./fakes/analytics-read-fakes";
import { HARNESS_NOW, HARNESS_ORG_ID, HARNESS_STORE_ID, reportingHarness } from "./fakes/reporting-harness";

const MEMBER = userActor("8d0f3b0e-1f7a-4c55-9d1e-2f1a6b7c8d90");

describe("GetMerchantDashboardHandler", () => {
	it("asks for merchant:view_analytics on the route's tenant and store before reading anything", async () => {
		const harness = reportingHarness();
		harness.access.allow = false;
		const handler = new GetMerchantDashboardHandler(harness.access, harness.dashboards);

		await expect(handler.execute(new GetMerchantDashboardQuery(MEMBER, { tenantId: HARNESS_ORG_ID, query: { locationId: HARNESS_STORE_ID } }))).rejects.toBeInstanceOf(
			MerchantAccessDeniedForTest,
		);
		expect(harness.access.requests).toEqual([
			{ actor: MEMBER, request: { tenantId: HARNESS_ORG_ID, capability: MERCHANT_CAPABILITY.viewAnalytics, locationId: HARNESS_STORE_ID } },
		]);
		expect(harness.facts.seriesCalls).toHaveLength(0);
		expect(harness.breakdowns.calls).toBe(0);
	});

	it("limits every aggregate to the stores the grant allows (never 'no filter')", async () => {
		const harness = reportingHarness();
		harness.access.grantScope = { locationScope: "SELECTED", locationIds: [HARNESS_STORE_ID] };
		const handler = new GetMerchantDashboardHandler(harness.access, harness.dashboards);

		const dashboard = await handler.execute(new GetMerchantDashboardQuery(MEMBER, { tenantId: HARNESS_ORG_ID, query: {} }));

		const scope = { kind: "tenant", tenantId: HARNESS_ORG_ID, locationScope: selectedAnalyticsLocations([HARNESS_STORE_ID]) };
		expect(harness.facts.seriesCalls.map((call) => call.scope)).toEqual([scope]);
		expect(harness.breakdowns.storeCalls.map((call) => call.scope)).toEqual([scope]);
		expect(harness.access.requests.map((entry) => entry.request.locationId)).toEqual([null]);
		expect(dashboard.range.timeZone).toBe("Asia/Kuala_Lumpur");
	});

	it("gives a store-limited grant with no stores an empty scope (matches nothing)", async () => {
		const harness = reportingHarness();
		harness.access.grantScope = { locationScope: "SELECTED", locationIds: [] };
		const handler = new GetMerchantDashboardHandler(harness.access, harness.dashboards);

		await handler.execute(new GetMerchantDashboardQuery(MEMBER, { tenantId: HARNESS_ORG_ID, query: {} }));

		expect(harness.facts.seriesCalls.map((call) => call.scope)).toEqual([{ kind: "tenant", tenantId: HARNESS_ORG_ID, locationScope: selectedAnalyticsLocations([]) }]);
	});
});

describe("GetMerchantAnalyticsHandler", () => {
	it("authorizes the same capability, then counts only the period's claims and redemptions of the grant's stores", async () => {
		const harness = reportingHarness();
		const key = apiKeyActor("key-1", HARNESS_ORG_ID);
		harness.access.grantScope = { locationScope: "SELECTED", locationIds: [HARNESS_STORE_ID] };
		harness.activity.merchantClaims = [
			{ claimedAt: HARNESS_NOW - DAY_MS, rewardId: "reward-1" },
			{ claimedAt: HARNESS_NOW - DAY_MS, rewardId: "reward-1" },
		];
		harness.activity.merchantRedemptions = [{ redeemedAt: HARNESS_NOW - DAY_MS, rewardId: "reward-1" }];
		harness.activity.titles = [{ id: "reward-1", title: "Free coffee" }];
		const handler = new GetMerchantAnalyticsHandler(harness.access, harness.weekly);

		const analytics = await handler.execute(new GetMerchantAnalyticsQuery(key, { tenantId: HARNESS_ORG_ID, query: {} }));

		expect(harness.access.requests.map((entry) => [entry.actor, entry.request.capability])).toEqual([[key, MERCHANT_CAPABILITY.viewAnalytics]]);
		expect(harness.activity.countFilters.every((filter) => filter.locationScope.kind === "SELECTED_LOCATIONS")).toBe(true);
		expect(harness.sales.aggregateScopes).toContainEqual({ tenantId: HARNESS_ORG_ID, locationIds: [HARNESS_STORE_ID] });
		expect(analytics.totalClaims.value).toBe(2);
		expect(analytics.totalRedemptions.value).toBe(1);
		expect(analytics.conversionRate.value).toBe(50);
		expect(analytics.topRewards).toEqual([{ rewardId: "reward-1", title: "Free coffee", claims: 2, redemptions: 1 }]);
		expect(analytics.period.timeZone).toBe("Asia/Kuala_Lumpur");
	});

	it("reads no fact when access is denied", async () => {
		const harness = reportingHarness();
		harness.access.allow = false;
		const handler = new GetMerchantAnalyticsHandler(harness.access, harness.weekly);

		await expect(handler.execute(new GetMerchantAnalyticsQuery(MEMBER, { tenantId: HARNESS_ORG_ID, query: {} }))).rejects.toBeInstanceOf(MerchantAccessDeniedForTest);
		expect(harness.activity.countFilters).toHaveLength(0);
		expect(harness.sales.aggregateScopes).toHaveLength(0);
	});
});

describe("ExportMerchantReportHandler", () => {
	it("exports the authorized dashboard under the tenant's slug and audits it once", async () => {
		const harness = reportingHarness();
		const handler = new ExportMerchantReportHandler(harness.access, harness.dashboards, harness.exporter);
		const request = await captureFastifyRequest({ headers: {} });

		const file = await handler.execute(
			new ExportMerchantReportQuery(MEMBER, {
				tenantId: HARNESS_ORG_ID,
				query: { format: "csv", from: epochMs(HARNESS_NOW - DAY_MS), to: epochMs(HARNESS_NOW) },
				request,
			}),
		);
		file.body.destroy();

		expect(file.fileName.startsWith("analytics_brew-and-bean_")).toBe(true);
		expect(harness.audit.rows.map((row) => row.request)).toEqual([request]);
	});

	it("neither renders nor audits when access is denied", async () => {
		const harness = reportingHarness();
		harness.access.allow = false;
		const handler = new ExportMerchantReportHandler(harness.access, harness.dashboards, harness.exporter);

		await expect(
			handler.execute(
				new ExportMerchantReportQuery(MEMBER, {
					tenantId: HARNESS_ORG_ID,
					query: { format: "pdf", from: epochMs(HARNESS_NOW - DAY_MS), to: epochMs(HARNESS_NOW) },
					request: await captureFastifyRequest({ headers: {} }),
				}),
			),
		).rejects.toBeInstanceOf(MerchantAccessDeniedForTest);
		expect(harness.renderers.rendered).toHaveLength(0);
		expect(harness.audit.rows).toHaveLength(0);
	});
});
