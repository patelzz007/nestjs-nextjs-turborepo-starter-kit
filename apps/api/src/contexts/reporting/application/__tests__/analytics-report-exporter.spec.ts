import { Readable } from "node:stream";

import { EpochMsSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { captureFastifyRequest } from "../../../../../test/support/fastify-request";
import { AnalyticsReportExporter } from "../assemblers/analytics-report-exporter";
import { ADMIN_DASHBOARD_FIXTURE, FIXTURE_FROM, FIXTURE_TO, MERCHANT_DASHBOARD_FIXTURE } from "./fakes/dashboard-fixtures";
import { FrozenClock } from "./fakes/analytics-read-fakes";
import { ExportAuditUnavailableForTest, RecordingExportAudit, TextReportRenderers } from "./fakes/report-export-fakes";

const NOW = EpochMsSchema.parse(Date.UTC(2026, 9, 5, 12));
const SUBJECT = { slug: "brew-and-bean", displayName: "Brew & Bean" };

function setup(): { readonly exporter: AnalyticsReportExporter; readonly renderers: TextReportRenderers; readonly audit: RecordingExportAudit } {
	const renderers = new TextReportRenderers();
	const audit = new RecordingExportAudit();
	return { exporter: new AnalyticsReportExporter(renderers, audit, "Starter", new FrozenClock(NOW)), renderers, audit };
}

describe("AnalyticsReportExporter", () => {
	it("names the file after the organization, the range's local first and last day, the interval and the format", async () => {
		const { exporter, renderers } = setup();

		const file = await exporter.exportMerchant(MERCHANT_DASHBOARD_FIXTURE, SUBJECT, "xlsx", await captureFastifyRequest({ headers: {} }));

		expect(file.fileName).toBe("analytics_brew-and-bean_2026-09-01_2026-09-30_week.xlsx");
		expect(file.contentType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
		expect(file.body).toBeInstanceOf(Readable);
		expect(renderers.rendered.map((entry) => [entry.format, entry.report.brand, entry.report.generatedAt])).toEqual([["xlsx", "Starter", NOW]]);
		file.body.destroy();
	});

	it("audits which report, range, format and how many rows — once, before releasing the file", async () => {
		const { exporter, audit } = setup();
		const request = await captureFastifyRequest({ headers: {} });

		const file = await exporter.exportMerchant(MERCHANT_DASHBOARD_FIXTURE, SUBJECT, "csv", request);
		file.body.destroy();

		expect(audit.rows).toEqual([
			{
				request,
				summary: {
					export: {
						report: "merchant",
						subject: "brew-and-bean",
						format: "csv",
						fileName: "analytics_brew-and-bean_2026-09-01_2026-09-30_week.csv",
						from: FIXTURE_FROM,
						to: FIXTURE_TO,
						timeZone: "Asia/Kuala_Lumpur",
						interval: "week",
						rowCounts: { series: 1, stores: 1, rewards: 0, redemptionMethods: 2 },
					},
				},
			},
		]);
	});

	it("releases nothing, and closes the rendered stream, when the audit row cannot be written", async () => {
		const { exporter, renderers, audit } = setup();
		audit.fail = true;

		await expect(exporter.exportMerchant(MERCHANT_DASHBOARD_FIXTURE, SUBJECT, "pdf", await captureFastifyRequest({ headers: {} }))).rejects.toBeInstanceOf(
			ExportAuditUnavailableForTest,
		);
		expect(renderers.rendered.map((entry) => entry.body.destroyed)).toEqual([true]);
	});

	it("exports the platform report under the `platform` subject", async () => {
		const { exporter } = setup();

		const file = await exporter.exportPlatform(ADMIN_DASHBOARD_FIXTURE, "pdf", await captureFastifyRequest({ headers: {} }));
		file.body.destroy();

		expect(file.fileName).toBe("analytics_platform_2026-08-31_2026-09-30_week.pdf");
		expect(file.contentType).toBe("application/pdf");
	});
});
