import { DAY_MS, epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { captureFastifyRequest } from "../../../../../test/support/fastify-request";
import { AuthenticationError } from "../../../../platform/application/errors/app-error";
import { ExportPlatformReportHandler } from "../queries/export-platform-report/export-platform-report.handler";
import { ExportPlatformReportQuery } from "../queries/export-platform-report/export-platform-report.query";
import { GetAdminDashboardHandler } from "../queries/get-admin-dashboard/get-admin-dashboard.handler";
import { GetAdminDashboardQuery } from "../queries/get-admin-dashboard/get-admin-dashboard.query";
import { GetAdminSalesAnalyticsHandler } from "../queries/get-admin-sales-analytics/get-admin-sales-analytics.handler";
import { GetAdminSalesAnalyticsQuery } from "../queries/get-admin-sales-analytics/get-admin-sales-analytics.query";
import { GetConsumerClaimAnalyticsHandler } from "../queries/get-consumer-claim-analytics/get-consumer-claim-analytics.handler";
import { GetConsumerClaimAnalyticsQuery } from "../queries/get-consumer-claim-analytics/get-consumer-claim-analytics.query";
import { GetConsumerDashboardHandler } from "../queries/get-consumer-dashboard/get-consumer-dashboard.handler";
import { GetConsumerDashboardQuery } from "../queries/get-consumer-dashboard/get-consumer-dashboard.query";
import { anonymousActor, apiKeyActor, userActor } from "./fakes/analytics-actors";
import { HARNESS_NOW, HARNESS_ORG_ID, reportingHarness } from "./fakes/reporting-harness";

const ADMIN_ID = "a1b2c3d4-0000-4000-8000-000000000001";
const CUSTOMER_ID = "c1b2c3d4-0000-4000-8000-000000000002";

describe("GetAdminDashboardHandler", () => {
	it("reads the platform scope", async () => {
		const harness = reportingHarness();
		await new GetAdminDashboardHandler(harness.dashboards).execute(new GetAdminDashboardQuery(userActor(ADMIN_ID), { query: {} }));

		expect(harness.facts.seriesCalls.map((call) => call.scope)).toEqual([{ kind: "platform" }]);
	});
});

describe("ExportPlatformReportHandler", () => {
	it("exports the platform dashboard and audits it", async () => {
		const harness = reportingHarness();
		const file = await new ExportPlatformReportHandler(harness.dashboards, harness.exporter).execute(
			new ExportPlatformReportQuery(userActor(ADMIN_ID), {
				query: { format: "csv", from: epochMs(HARNESS_NOW - DAY_MS), to: epochMs(HARNESS_NOW) },
				request: await captureFastifyRequest({ headers: {} }),
			}),
		);
		file.body.destroy();

		expect(file.fileName.startsWith("analytics_platform_")).toBe(true);
		expect(harness.audit.rows).toHaveLength(1);
	});
});

describe("GetAdminSalesAnalyticsHandler", () => {
	it("names the top merchants through a system read recorded against the admin", async () => {
		const harness = reportingHarness();
		harness.sales.groups = [{ tenantId: HARNESS_ORG_ID, totalMinor: 5_000, bills: 2 }];
		harness.sales.summaries = new Map([[HARNESS_ORG_ID, { name: "Brew & Bean", category: "cafe" }]]);

		const sales = await new GetAdminSalesAnalyticsHandler(harness.weekly).execute(new GetAdminSalesAnalyticsQuery(userActor(ADMIN_ID), { query: {} }));

		expect(harness.sales.summaryCalls).toEqual([{ tenantIds: [HARNESS_ORG_ID], actorUserId: ADMIN_ID }]);
		expect(sales.topMerchants).toEqual([{ tenantId: HARNESS_ORG_ID, name: "Brew & Bean", category: "cafe", salesMinor: 5_000, bills: 2 }]);
		expect(sales.period.timeZone).toBe("UTC");
	});
});

describe("GetConsumerDashboardHandler", () => {
	it("reads only the calling customer's own activity", async () => {
		const harness = reportingHarness();
		await new GetConsumerDashboardHandler(harness.dashboards).execute(new GetConsumerDashboardQuery(userActor(CUSTOMER_ID), { query: {} }));

		expect(harness.facts.seriesCalls.map((call) => call.scope)).toEqual([{ kind: "customer", userId: CUSTOMER_ID }]);
	});

	it("refuses a caller that is not a signed-in user", async () => {
		const harness = reportingHarness();
		await expect(
			new GetConsumerDashboardHandler(harness.dashboards).execute(new GetConsumerDashboardQuery(apiKeyActor("key-1", HARNESS_ORG_ID), { query: {} })),
		).rejects.toBeInstanceOf(AuthenticationError);
		expect(harness.facts.seriesCalls).toHaveLength(0);
	});
});

describe("GetConsumerClaimAnalyticsHandler", () => {
	it("counts the customer's claims of the period by status", async () => {
		const harness = reportingHarness();
		harness.activity.customerClaims = [
			{ claimedAt: HARNESS_NOW - DAY_MS, redeemedAt: HARNESS_NOW, status: "REDEEMED" },
			{ claimedAt: HARNESS_NOW - DAY_MS, redeemedAt: null, status: "PENDING" },
		];

		const analytics = await new GetConsumerClaimAnalyticsHandler(harness.weekly).execute(new GetConsumerClaimAnalyticsQuery(userActor(CUSTOMER_ID), { query: {} }));

		expect(analytics.totalClaims.value).toBe(2);
		expect(analytics.redeemedClaims.value).toBe(1);
		expect(analytics.byStatus).toEqual([
			{ status: "PENDING", count: 1 },
			{ status: "REDEEMED", count: 1 },
			{ status: "EXPIRED", count: 0 },
		]);
	});

	it("refuses an anonymous caller", async () => {
		const harness = reportingHarness();
		await expect(new GetConsumerClaimAnalyticsHandler(harness.weekly).execute(new GetConsumerClaimAnalyticsQuery(anonymousActor(), { query: {} }))).rejects.toBeInstanceOf(
			AuthenticationError,
		);
	});
});
