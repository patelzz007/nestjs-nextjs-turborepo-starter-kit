import { ReportFontRegistry } from "../../src/modules/rewards/analytics/report/fonts/report-font-registry";

let registry: ReportFontRegistry | undefined;

/** The real report font registry (bundled Noto fonts), loaded once per test file. */
export function testReportFontRegistry(): ReportFontRegistry {
	registry ??= new ReportFontRegistry();
	return registry;
}
