import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import type * as React from "react";

import { AUDIT_RECORD_GRID_BY_LAYOUT, type AuditRecordLayout } from "@/contexts/audit/components/audit-logs/record-layout";
import { DATA_CHANGE_RECORD_LOADING_LABELS } from "@/components/loading/loading-labels";
import { BadgeSkeleton, LabelledValueGridSkeleton } from "@/components/loading/skeleton-parts";

/** `DataChangeRecord`'s labelled sections in render order, with how many fields each shows. */
const DATA_CHANGE_RECORD_SECTIONS: readonly { readonly key: string; readonly fields: number }[] = [
	{ key: "who", fields: 6 },
	{ key: "when", fields: 2 },
	{ key: "connection", fields: 4 },
	{ key: "tracing", fields: 5 },
];
/** Diff rows the before / after table shows while it loads. */
const DIFF_PLACEHOLDER_ROWS = 6;

/**
 * `DataChangeRecord`'s bones: the operation / table / attribution header, the
 * before-and-after table and the four labelled sections — the same grids per
 * layout, so the record lands exactly where its skeleton stood.
 */
export function DataChangeRecordSkeleton({ layout }: { readonly layout: AuditRecordLayout }): React.JSX.Element {
	return (
		<div data-skeleton="data-change-record" className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<div className="flex flex-wrap items-center gap-2">
					<BadgeSkeleton className="w-14" />
					<Skeleton variant="text" className="h-4.5 w-48 max-w-full" />
					<BadgeSkeleton className="w-20" />
				</div>
				<Skeleton variant="text" className="h-3 w-72 max-w-full" />
			</div>
			<div data-skeleton="data-change-diff" className="flex flex-col gap-3 rounded-lg border bg-card p-4">
				<Skeleton variant="text" className="h-3.5 w-40" />
				{placeholderKeys("diff-row", DIFF_PLACEHOLDER_ROWS).map((key) => (
					<Skeleton key={key} variant="text" className="h-4 w-full" />
				))}
			</div>
			{DATA_CHANGE_RECORD_SECTIONS.map((section) => (
				<div key={section.key} data-skeleton="data-change-record-section" className="flex flex-col gap-3 rounded-lg border bg-card p-4">
					<div className="flex flex-col gap-1.5">
						<Skeleton variant="text" className="h-3.5 w-28" />
						<Skeleton variant="text" className="h-3 w-72 max-w-full" />
					</div>
					<LabelledValueGridSkeleton count={section.fields} className={AUDIT_RECORD_GRID_BY_LAYOUT[layout]} />
				</div>
			))}
		</div>
	);
}

/** The data-change drawer while its record loads. */
export function DataChangeDrawerSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={DATA_CHANGE_RECORD_LOADING_LABELS} className="block pt-4">
			<DataChangeRecordSkeleton layout="drawer" />
		</SkeletonRegion>
	);
}

/** `/audit-logs/changes/[id]`: the "Back to audit log" button over the full-page record. */
export function DataChangeDetailPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={DATA_CHANGE_RECORD_LOADING_LABELS} className="mx-auto flex w-full max-w-7xl flex-col gap-6">
			<Skeleton className="h-8 w-44" />
			<DataChangeRecordSkeleton layout="page" />
		</SkeletonRegion>
	);
}
