import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/ui/lib/core/utils";
import type { JSX } from "react";

import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";

/** Device rows drawn while the list loads — the current device plus one other is the usual account. */
export const SIGNED_IN_DEVICES_SKELETON_ROWS = 2;
/** Detail pairs per row (signed in with, sign-in IP, signed in, last active, …) — the common fields every session has. */
const DETAIL_PAIRS = 4;
/** Device-label widths, cycled per row so the rows read as different devices. */
const LABEL_WIDTHS: readonly string[] = ["w-44", "w-36", "w-40"];

export interface SignedInDevicesSkeletonProps {
	/** How many device rows. Default {@link SIGNED_IN_DEVICES_SKELETON_ROWS}. */
	readonly rows?: number;
}

/**
 * The device list's silhouette (`DeviceSessionRow`): the device-class tile,
 * the label with its app and "this device" badges, the platform line and the
 * two-column detail grid. Bones only — wrap it in one `SkeletonRegion`.
 */
export function SignedInDevicesSkeleton({ rows = SIGNED_IN_DEVICES_SKELETON_ROWS }: SignedInDevicesSkeletonProps): JSX.Element {
	const detailKeys = placeholderKeys("detail", DETAIL_PAIRS);
	return (
		<ul data-slot="signed-in-devices-skeleton" className="divide-y">
			{placeholderKeys("device", rows).map((key, index): JSX.Element => (
				<li key={key} className="flex gap-3 py-4 first:pt-0 last:pb-0">
					<Skeleton className="size-10 rounded-lg" />
					<div className="flex min-w-0 flex-1 flex-col gap-2.5">
						<div className="flex flex-wrap items-center gap-2">
							<Skeleton variant="text" className={cn("h-4", LABEL_WIDTHS[index % LABEL_WIDTHS.length] ?? "w-40")} />
							<Skeleton className="h-5 w-16 rounded-full" />
						</div>
						<Skeleton variant="text" className="h-3.5 w-48 max-w-full" />
						<div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
							{detailKeys.map((detailKey): JSX.Element => (
								<Skeleton key={detailKey} variant="text" className="h-3.5 w-52 max-w-full" />
							))}
						</div>
					</div>
				</li>
			))}
		</ul>
	);
}
