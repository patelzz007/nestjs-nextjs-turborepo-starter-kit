import type { ReferenceDataSyncReport, SectionReport } from "./reference-data-sync.service";
import { changeCount } from "./reference-data.types";

/** Exit codes of `db:sync-reference-data`. */
export const SYNC_REFERENCE_DATA_EXIT_CODES = { success: 0, failed: 70 } satisfies Record<string, number>;

/** One line per section plus a verdict; never prints row contents. */
export function formatReferenceDataReport(report: ReferenceDataSyncReport): string {
	const lines: string[] = report.sections.map(
		({ section, change }: SectionReport): string =>
			`  ${section.padEnd(22)} created ${String(change.created)}, updated ${String(change.updated)}, restored ${String(change.restored)}, retired ${String(change.retired)}${changeCount(change) === 0 ? " (already up to date)" : ""}`,
	);
	const verdict: string =
		report.totalChanges === 0
			? "Reference data already matches the catalog: nothing was written."
			: `Reference data synced: ${String(report.totalChanges)} change(s) written and audited.`;
	return ["Reference data sync", ...lines, verdict].join("\n");
}
