import { Skeleton } from "@workspace/ui/components/skeleton";
import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { cn } from "@workspace/ui/lib/core/utils";
import type * as React from "react";

import { AUDIT_LOG_RECORD_PAYLOAD_GRID_BY_LAYOUT } from "@/contexts/audit/components/audit-logs/audit-log-record";
import { AUDIT_RECORD_GRID_BY_LAYOUT, type AuditRecordLayout } from "@/contexts/audit/components/audit-logs/record-layout";
import { AUDIT_RECORD_LOADING_LABELS } from "@/components/loading/loading-labels";
import { BadgeSkeleton, LabelledValueGridSkeleton } from "@/components/loading/skeleton-parts";

/** `AuditLogRecord`'s labelled sections in render order, with how many fields each shows. */
const AUDIT_RECORD_SECTIONS: readonly { readonly key: string; readonly fields: number }[] = [
	{ key: "who", fields: 9 },
	{ key: "when", fields: 4 },
	{ key: "device-location", fields: 8 },
	{ key: "request-headers", fields: 9 },
	{ key: "tracing", fields: 5 },
];
/** Route params & query, request body, response body. */
const AUDIT_RECORD_PAYLOAD_PANELS = 3;

/** One bordered record section: title, one-line description, its field grid. */
function RecordSectionSkeleton({ fields, layout }: { readonly fields: number; readonly layout: AuditRecordLayout }): React.JSX.Element {
	return (
		<div data-skeleton="audit-log-record-section" className="flex flex-col gap-3 rounded-lg border bg-card p-4">
			<div className="flex flex-col gap-1.5">
				<Skeleton variant="text" className="h-3.5 w-28" />
				<Skeleton variant="text" className="h-3 w-72 max-w-full" />
			</div>
			<LabelledValueGridSkeleton count={fields} className={AUDIT_RECORD_GRID_BY_LAYOUT[layout]} />
		</div>
	);
}

/**
 * `AuditLogRecord`'s bones: the method/endpoint/outcome header, the five
 * labelled sections and the three payload panels — the same grids per layout,
 * so the record lands exactly where its skeleton stood.
 */
export function AuditLogRecordSkeleton({ layout }: { readonly layout: AuditRecordLayout }): React.JSX.Element {
	return (
		<div data-skeleton="audit-log-record" className="flex flex-col gap-4">
			<div className="flex flex-col gap-2">
				<div className="flex flex-wrap items-center gap-2">
					<BadgeSkeleton className="w-12" />
					<Skeleton variant="text" className="h-4.5 w-72 max-w-full" />
					<BadgeSkeleton className="w-20" />
				</div>
				<Skeleton variant="text" className="h-3 w-96 max-w-full" />
				<div className="flex items-center gap-2">
					<Skeleton variant="circular" className="size-6" />
					<Skeleton variant="text" className="h-3.5 w-40" />
				</div>
			</div>
			{AUDIT_RECORD_SECTIONS.map((section) => (
				<RecordSectionSkeleton key={section.key} fields={section.fields} layout={layout} />
			))}
			<div className={cn("grid gap-4", AUDIT_LOG_RECORD_PAYLOAD_GRID_BY_LAYOUT[layout])}>
				{placeholderKeys("payload", AUDIT_RECORD_PAYLOAD_PANELS).map((key) => (
					<div key={key} data-skeleton="audit-log-record-payload" className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-4">
						<Skeleton variant="text" className="h-3.5 w-36" />
						<Skeleton className="h-32 w-full" />
					</div>
				))}
			</div>
		</div>
	);
}

/** The audit log drawer while its record loads — the record's bones in the drawer layout. */
export function AuditLogDrawerSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={AUDIT_RECORD_LOADING_LABELS} className="block pt-4">
			<AuditLogRecordSkeleton layout="drawer" />
		</SkeletonRegion>
	);
}

/** `/audit-logs/[id]`: the small "Back to audit log" button over the full-page record. */
export function AuditLogDetailPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={AUDIT_RECORD_LOADING_LABELS} className="mx-auto flex w-full max-w-7xl flex-col gap-6">
			<Skeleton className="h-8 w-40" />
			<AuditLogRecordSkeleton layout="page" />
		</SkeletonRegion>
	);
}
