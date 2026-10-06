import { Readable } from "node:stream";

import { EpochMsSchema, type AdminAnalyticsDashboard, type MerchantAnalyticsDashboard } from "@workspace/shared";
import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { createAuditTrailDouble } from "../../../../test/support/audit-trail-double";
import { captureFastifyRequest } from "../../../../test/support/fastify-request";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { AuditLogWriteError } from "../../../common/audit/audit-log.errors";
import { AuditTrailService } from "../../../common/audit/audit-trail.service";
import { TypedConfigService } from "../../../config/typed-config.service";
import { RequestContextService } from "../../../common/context/request-context";
import type { MerchantActor } from "../../api-keys/types/merchant-actor.types";
import { ANALYTICS_CLOCK, AnalyticsDashboardService } from "./analytics-dashboard.service";
import { AnalyticsExportService } from "./analytics-export.service";
import { ReportFontRegistry } from "./report/fonts/report-font-registry";
import { testReportFontRegistry } from "../../../../test/support/report-fonts";
import { AnalyticsReportRendererRegistry } from "./report/renderers/analytics-report-renderer.registry";
import { CsvAnalyticsReportRenderer } from "./report/renderers/csv-analytics-report.renderer";
import { PdfAnalyticsReportRenderer } from "./report/renderers/pdf-analytics-report.renderer";
import { XlsxAnalyticsReportRenderer } from "./report/renderers/xlsx-analytics-report.renderer";

const NOW = Date.UTC(2026, 9, 5, 12);
/** 2026-09-01 00:00 and 2026-10-01 00:00 in Kuala Lumpur. */
const FROM = EpochMsSchema.parse(Date.UTC(2026, 7, 31, 16));
const TO = EpochMsSchema.parse(Date.UTC(2026, 8, 30, 16));
const ACTOR: MerchantActor = { kind: "user", userId: "user-1", organizationId: "org-1", orgSlug: "brew" };
const SEED = { correlationId: "corr-export", ip: "203.0.113.9", userAgent: "vitest", edgeLocation: undefined };

const RANGE = {
	from: FROM,
	to: TO,
	timeZone: "Asia/Kuala_Lumpur",
	interval: "week",
	previousFrom: EpochMsSchema.parse(FROM - (TO - FROM)),
	previousTo: FROM,
} satisfies MerchantAnalyticsDashboard["range"];
const ZERO = { value: 0, previous: 0, change: 0, changePercent: null };

const MERCHANT_DASHBOARD: MerchantAnalyticsDashboard = {
	range: RANGE,
	currency: "MYR",
	firstBillAt: null,
	totals: { salesMinor: ZERO, bills: ZERO, averageBillMinor: ZERO, claims: ZERO, redemptions: ZERO, conversionRate: ZERO, customers: ZERO },
	series: [{ start: FROM, end: TO, isPartial: true, salesMinor: 0, bills: 0, averageBillMinor: 0, claims: 0, redemptions: 0 }],
	byStore: [{ locationId: null, name: null, city: null, salesMinor: 0, bills: 0, averageBillMinor: 0, redemptions: 0 }],
	byReward: [],
	byRedemptionMethod: [
		{ method: "SCAN", redemptions: 0 },
		{ method: "MANUAL", redemptions: 0 },
	],
};

const ADMIN_DASHBOARD: AdminAnalyticsDashboard = {
	range: { ...RANGE, timeZone: "UTC" },
	currency: "MYR",
	totals: {
		salesMinor: ZERO,
		bills: ZERO,
		averageBillMinor: ZERO,
		claims: ZERO,
		redemptions: ZERO,
		conversionRate: ZERO,
		activeMerchants: ZERO,
		customers: ZERO,
		newCustomers: ZERO,
		returningCustomers: ZERO,
	},
	series: [],
	topMerchants: [],
	byCategory: [],
	byCity: [],
};

interface ExportFixture {
	readonly service: AnalyticsExportService;
	readonly append: ReturnType<typeof createAuditTrailDouble>["append"];
	readonly getAdminDashboard: MockInstance<AnalyticsDashboardService["getAdminDashboard"]>;
	readonly requestContext: RequestContextService;
}

async function setup(): Promise<ExportFixture> {
	const requestContext = new RequestContextService();
	const { auditTrail, append } = createAuditTrailDouble(requestContext);
	const getAdminDashboard = vi.fn<AnalyticsDashboardService["getAdminDashboard"]>().mockResolvedValue(ADMIN_DASHBOARD);
	const dashboards = {
		buildMerchantDashboard: vi
			.fn<AnalyticsDashboardService["buildMerchantDashboard"]>()
			.mockResolvedValue({ dashboard: MERCHANT_DASHBOARD, subject: { slug: "brew-and-bean", displayName: "Brew & Bean" } }),
		getAdminDashboard,
	};
	const moduleRef = await Test.createTestingModule({
		providers: [
			AnalyticsExportService,
			AnalyticsReportRendererRegistry,
			CsvAnalyticsReportRenderer,
			XlsxAnalyticsReportRenderer,
			PdfAnalyticsReportRenderer,
			{ provide: ReportFontRegistry, useValue: testReportFontRegistry() },
			{ provide: AnalyticsDashboardService, useValue: dashboards },
			{ provide: AuditTrailService, useValue: auditTrail },
			{ provide: TypedConfigService, useValue: createTestTypedConfig() },
			{ provide: ANALYTICS_CLOCK, useValue: { nowEpochMs: (): number => NOW } },
		],
	}).compile();
	return { service: moduleRef.get(AnalyticsExportService), append, getAdminDashboard, requestContext };
}

describe("AnalyticsExportService", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("names the file after the organization, the range's local first and last day, the interval and the format", async () => {
		const { service, requestContext } = await setup();
		const request = await captureFastifyRequest({ headers: {} });

		const file = await requestContext.run(SEED, () => service.exportMerchantReport(ACTOR, { from: FROM, to: TO, format: "xlsx" }, request));

		expect(file.fileName).toBe("analytics_brew-and-bean_2026-09-01_2026-09-30_week.xlsx");
		expect(file.contentType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
		expect(file.body).toBeInstanceOf(Readable);
		file.body.destroy();
	});

	it("audits who exported which report, range, format and how many rows — before releasing the file", async () => {
		const { service, append, requestContext } = await setup();
		const request = await captureFastifyRequest({ headers: {} });

		const file = await requestContext.run(SEED, () => service.exportMerchantReport(ACTOR, { from: FROM, to: TO, format: "csv" }, request));
		file.body.destroy();

		expect(append).toHaveBeenCalledTimes(1);
		expect(append).toHaveBeenCalledWith(
			expect.objectContaining({
				outcome: "SUCCEEDED",
				responseStatus: 200,
				responseBody: {
					export: {
						report: "merchant",
						subject: "brew-and-bean",
						format: "csv",
						fileName: "analytics_brew-and-bean_2026-09-01_2026-09-30_week.csv",
						from: FROM,
						to: TO,
						timeZone: "Asia/Kuala_Lumpur",
						interval: "week",
						rowCounts: { series: 1, stores: 1, rewards: 0, redemptionMethods: 2 },
					},
				},
			}),
		);
	});

	it("releases nothing when the audit row cannot be written", async () => {
		const { service, append, requestContext } = await setup();
		append.mockRejectedValueOnce(new Error("db down"));
		vi.spyOn(Logger.prototype, "error").mockImplementation((): void => undefined);
		const request = await captureFastifyRequest({ headers: {} });

		await expect(requestContext.run(SEED, () => service.exportMerchantReport(ACTOR, { from: FROM, to: TO, format: "pdf" }, request))).rejects.toBeInstanceOf(
			AuditLogWriteError,
		);
	});

	it("exports the platform report under the `platform` subject", async () => {
		const { service, getAdminDashboard, requestContext } = await setup();
		const request = await captureFastifyRequest({ headers: {} });

		const file = await requestContext.run(SEED, () => service.exportPlatformReport({ from: FROM, to: TO, format: "pdf" }, request));
		file.body.destroy();

		expect(getAdminDashboard).toHaveBeenCalledWith({ from: FROM, to: TO, format: "pdf" });
		expect(file.fileName).toBe("analytics_platform_2026-08-31_2026-09-30_week.pdf");
		expect(file.contentType).toBe("application/pdf");
	});
});
