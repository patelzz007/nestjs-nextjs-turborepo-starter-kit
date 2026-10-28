import { Card, CardContent, CardHeader } from "@workspace/ui/components/card";
import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { SettingsSectionHeaderSkeleton } from "@workspace/ui/components/settings-shell";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import type * as React from "react";

import { ACCESS_CONTROL_LOADING_LABELS } from "@/components/loading/loading-labels";
import { BadgeSkeleton, CardHeadingSkeleton } from "@/components/loading/skeleton-parts";

/** Role rows drawn while the role catalog loads. */
const ROLE_SKELETON_ROWS = 5;
/** Category rows drawn while the permission catalog loads. */
const PERMISSION_GROUP_SKELETON_ROWS = 6;

/** The role catalog's rows: name + description beside the active badge. */
export function RoleRowsSkeleton(): React.JSX.Element {
	return (
		<>
			{placeholderKeys("role", ROLE_SKELETON_ROWS).map((key) => (
				<div key={key} data-skeleton="role-row" className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
					<div className="flex min-w-0 flex-col gap-1.5">
						<Skeleton variant="text" className="h-3.5 w-28" />
						<Skeleton variant="text" className="h-3 w-56 max-w-full" />
					</div>
					<BadgeSkeleton className="w-14" />
				</div>
			))}
		</>
	);
}

/** The permission explorer's collapsed category rows: chevron, category name, permission count. */
export function PermissionGroupsSkeleton(): React.JSX.Element {
	return (
		<div className="flex flex-col divide-y divide-border/70">
			{placeholderKeys("permission-group", PERMISSION_GROUP_SKELETON_ROWS).map((key) => (
				<div key={key} data-skeleton="permission-group" className="flex items-center gap-3 py-3">
					<Skeleton className="size-4 rounded-sm" />
					<Skeleton variant="text" className="h-3.5 w-40" />
					<BadgeSkeleton className="ms-auto w-10" />
				</div>
			))}
		</div>
	);
}

/** `/settings/access`: the section header, the roles / permissions / checker tab list, then the roles card (the first tab). */
export function AccessControlPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={ACCESS_CONTROL_LOADING_LABELS} className="flex flex-col gap-6">
			<SettingsSectionHeaderSkeleton />
			<div className="flex flex-col gap-4">
				<Skeleton className="h-9 w-96 max-w-full rounded-lg" />
				<Card>
					<CardHeader>
						<CardHeadingSkeleton />
					</CardHeader>
					<CardContent className="flex flex-col gap-2">
						<RoleRowsSkeleton />
					</CardContent>
				</Card>
			</div>
		</SkeletonRegion>
	);
}
