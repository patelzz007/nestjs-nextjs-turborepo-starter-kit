import { ReportFontLoader, ReportFontRegistry } from "../../src/contexts/reporting/infrastructure/report/fonts/report-font-registry";

let registry: ReportFontRegistry | undefined;

/** The real report font registry (bundled Noto fonts), loaded once per test file. */
export function testReportFontRegistry(): ReportFontRegistry {
	registry ??= new ReportFontRegistry();
	return registry;
}

/** A loader over the real fonts that hands every render the same registry, so a test file parses them once. */
class SharedRegistryLoader extends ReportFontLoader {
	public override load(): ReportFontRegistry {
		return testReportFontRegistry();
	}
}

export function testReportFontLoader(): ReportFontLoader {
	return new SharedRegistryLoader();
}
