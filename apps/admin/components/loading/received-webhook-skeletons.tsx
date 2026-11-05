import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import type * as React from "react";

import { AUDIT_RECORD_GRID_BY_LAYOUT } from "@/contexts/audit/components/audit-logs/record-layout";
import { RECEIVED_WEBHOOK_LOADING_LABELS } from "@/components/loading/loading-labels";
import { BadgeSkeleton, LabelledValueGridSkeleton } from "@/components/loading/skeleton-parts";

/** `ReceivedWebhookRecord`'s labelled sections in render order, with how many fields each shows. */
const RECEIVED_WEBHOOK_SECTIONS: readonly { readonly key: string; readonly fields: number }[] = [
	{ key: "delivery", fields: 8 },
	{ key: "when", fields: 4 },
	{ key: "payload", fields: 2 },
];
/** Header rows the headers table shows while it loads. */
const HEADER_PLACEHOLDER_ROWS = 4;
/** The tracing section's fields. */
const TRACING_FIELDS = 2;

function SectionSkeleton({ fields }: { readonly fields: number }): React.JSX.Element {
	return (
		<div data-skeleton="received-webhook-section" className="flex flex-col gap-3 rounded-lg border bg-card p-4">
			<div className="flex flex-col gap-1.5">
				<Skeleton variant="text" className="h-3.5 w-28" />
				<Skeleton variant="text" className="h-3 w-72 max-w-full" />
			</div>
			<LabelledValueGridSkeleton count={fields} className={AUDIT_RECORD_GRID_BY_LAYOUT.page} />
		</div>
	);
}

/** `/webhooks/received/[id]`: the "Back" button over the record's header, sections and headers table — the same grids as the record. */
export function ReceivedWebhookDetailPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={RECEIVED_WEBHOOK_LOADING_LABELS} className="mx-auto flex w-full max-w-10xl flex-col gap-6">
			<Skeleton className="h-8 w-52" />
			<div data-skeleton="received-webhook-record" className="flex flex-col gap-4">
				<div className="flex flex-col gap-2">
					<div className="flex flex-wrap items-center gap-2">
						<Skeleton variant="text" className="h-5 w-32" />
						<BadgeSkeleton className="w-24" />
						<BadgeSkeleton className="w-20" />
					</div>
					<Skeleton variant="text" className="h-3 w-72 max-w-full" />
				</div>
				{RECEIVED_WEBHOOK_SECTIONS.map((section) => (
					<SectionSkeleton key={section.key} fields={section.fields} />
				))}
				<div data-skeleton="received-webhook-headers" className="flex flex-col gap-3 rounded-lg border bg-card p-4">
					<Skeleton variant="text" className="h-3.5 w-24" />
					{placeholderKeys("header-row", HEADER_PLACEHOLDER_ROWS).map((key) => (
						<Skeleton key={key} variant="text" className="h-4 w-full" />
					))}
				</div>
				<SectionSkeleton fields={TRACING_FIELDS} />
			</div>
		</SkeletonRegion>
	);
}
