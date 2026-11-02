import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import type { JSX } from "react";

/** What the inbox's loading region announces to screen readers. */
export const NOTIFICATIONS_INBOX_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading notifications…" };

/** Rows the skeleton shows: about one screen of the inbox. */
const SKELETON_ROWS: readonly number[] = [1, 2, 3, 4, 5];

/**
 * Bones for {@link NotificationsInbox}: the header with its "mark all" button, the three view tabs and a
 * screen of rows (title, body line, time), so the page keeps its shape while it loads.
 */
export function NotificationsInboxSkeleton(): JSX.Element {
	return (
		<SkeletonRegion labels={NOTIFICATIONS_INBOX_LOADING_LABELS} className="flex flex-col gap-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex flex-col gap-1">
					<Skeleton className="my-0.5 h-7 w-48" />
					<Skeleton variant="text" className="my-0.5 h-4 w-80 max-w-full" />
				</div>
				<Skeleton className="h-9 w-36" />
			</div>
			<Skeleton className="h-9 w-64" />
			<div data-slot="notifications-inbox-skeleton" className="flex flex-col divide-y divide-border rounded-xl border border-border">
				{SKELETON_ROWS.map((row: number) => (
					<div key={row} className="flex flex-col gap-1.5 px-4 py-4">
						<Skeleton variant="text" className="h-4 w-56 max-w-full" />
						<Skeleton variant="text" className="h-3.5 w-full max-w-lg" />
						<Skeleton variant="text" className="h-3 w-20" />
					</div>
				))}
			</div>
		</SkeletonRegion>
	);
}
