import { ACCOUNT_SETTINGS_LOADING_LABELS } from "@/components/loading/loading-labels";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { FormSkeleton, ListSkeleton, PageHeaderSkeleton, ProseSkeleton } from "@workspace/ui/components/skeleton-patterns";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

/** Change password: current, new and confirmation fields. */
const PASSWORD_FIELD_COUNT = 3;
/** A couple of signed-in devices — enough to read as a list. */
const DEVICE_SKELETON_ROWS = 2;
/** The short explanatory paragraphs in the two-factor and recovery sections. */
const SECTION_PROSE_LINES = 2;

/** One `SecuritySettingsPanel` section: bordered card, `text-lg` heading and subtitle, then its body. */
function SettingsSectionSkeleton({ className, children }: { readonly className?: string; readonly children: React.ReactNode }): React.JSX.Element {
	return (
		<div className={cn("space-y-4 rounded-xl border bg-card p-6", className)}>
			<div className="flex flex-col">
				<Skeleton variant="text" className="my-1 h-5 w-44" />
				<Skeleton variant="text" className="my-0.5 h-4 w-72 max-w-full" />
			</div>
			{children}
		</div>
	);
}

/**
 * `/rewardhub/account` while the session check runs: the settings header, the
 * profile picture, then the security sections in their grid — email
 * verification, password, two-factor, signed-in devices and MFA recovery.
 */
export function AccountSettingsSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={ACCOUNT_SETTINGS_LOADING_LABELS} className="flex flex-col gap-8">
			<PageHeaderSkeleton />
			<SettingsSectionSkeleton>
				<div className="flex items-center gap-4" data-skeleton="profile-picture">
					<Skeleton className="size-16 rounded-full" />
					<div className="space-y-2">
						<Skeleton className="h-8 w-32" />
						<Skeleton variant="text" className="h-3 w-64 max-w-full" />
					</div>
				</div>
			</SettingsSectionSkeleton>
			<div className="grid gap-8 lg:grid-cols-2">
				<SettingsSectionSkeleton className="lg:col-span-2">
					<div className="flex flex-wrap items-center justify-between gap-4">
						<Skeleton variant="text" className="h-4 w-64 max-w-full" />
						<Skeleton className="h-9 w-40" />
					</div>
				</SettingsSectionSkeleton>
				<SettingsSectionSkeleton>
					<FormSkeleton surface="plain" fields={PASSWORD_FIELD_COUNT} />
				</SettingsSectionSkeleton>
				<SettingsSectionSkeleton>
					<ProseSkeleton lines={SECTION_PROSE_LINES} />
					<Skeleton className="h-9 w-40" />
				</SettingsSectionSkeleton>
				<SettingsSectionSkeleton className="lg:col-span-2">
					<ListSkeleton surface="plain" leading="icon" rows={DEVICE_SKELETON_ROWS} />
				</SettingsSectionSkeleton>
				<SettingsSectionSkeleton className="lg:col-span-2">
					<ProseSkeleton lines={SECTION_PROSE_LINES} />
					<Skeleton className="h-9 w-48" />
				</SettingsSectionSkeleton>
			</div>
		</SkeletonRegion>
	);
}
