import { EpochMsSchema } from "@workspace/shared";

import { AnalyticsDashboardAssembler } from "../../assemblers/analytics-dashboard.assembler";
import { AnalyticsReportExporter } from "../../assemblers/analytics-report-exporter";
import { WeeklyAnalyticsAssembler } from "../../assemblers/weekly-analytics.assembler";
import {
	FakeMerchantAccess,
	FrozenClock,
	InMemoryAnalyticsBreakdowns,
	InMemoryAnalyticsFacts,
	InMemoryAnalyticsTenants,
	InMemoryRewardActivity,
	InMemorySales,
} from "./analytics-read-fakes";
import { RecordingExportAudit, TextReportRenderers } from "./report-export-fakes";

/** 2026-10-05 12:00 UTC: "now" for every handler test. */
export const HARNESS_NOW = Date.UTC(2026, 9, 5, 12);
export const HARNESS_ORG_ID = "5c1f7a9e-2b4d-4e8f-a1b2-c3d4e5f60718";
export const HARNESS_STORE_ID = "7a2b3c4d-5e6f-4a1b-8c9d-0e1f2a3b4c5d";

/** Real assemblers over in-memory ports: what the query handlers run against in unit tests. */
export interface ReportingHarness {
	readonly access: FakeMerchantAccess;
	readonly facts: InMemoryAnalyticsFacts;
	readonly breakdowns: InMemoryAnalyticsBreakdowns;
	readonly tenants: InMemoryAnalyticsTenants;
	readonly sales: InMemorySales;
	readonly activity: InMemoryRewardActivity;
	readonly audit: RecordingExportAudit;
	readonly renderers: TextReportRenderers;
	readonly dashboards: AnalyticsDashboardAssembler;
	readonly weekly: WeeklyAnalyticsAssembler;
	readonly exporter: AnalyticsReportExporter;
}

export function reportingHarness(): ReportingHarness {
	const clock = new FrozenClock(EpochMsSchema.parse(HARNESS_NOW));
	const facts = new InMemoryAnalyticsFacts();
	const breakdowns = new InMemoryAnalyticsBreakdowns();
	const tenants = new InMemoryAnalyticsTenants();
	tenants.rows.set(HARNESS_ORG_ID, { slug: "brew-and-bean", displayName: "Brew & Bean", timeZone: "Asia/Kuala_Lumpur" });
	const sales = new InMemorySales();
	const activity = new InMemoryRewardActivity();
	const audit = new RecordingExportAudit();
	const renderers = new TextReportRenderers();
	return {
		access: new FakeMerchantAccess(),
		facts,
		breakdowns,
		tenants,
		sales,
		activity,
		audit,
		renderers,
		dashboards: new AnalyticsDashboardAssembler(facts, breakdowns, tenants, sales, clock),
		weekly: new WeeklyAnalyticsAssembler(activity, sales, tenants, clock),
		exporter: new AnalyticsReportExporter(renderers, audit, "Starter", clock),
	};
}
