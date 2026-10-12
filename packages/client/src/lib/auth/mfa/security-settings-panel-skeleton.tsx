import { FormSkeleton } from "@workspace/ui/components/skeleton-patterns";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/ui/lib/core/utils";
import type { JSX, ReactNode } from "react";

import { SignedInDevicesSkeleton } from "../sessions/signed-in-devices-skeleton";

/** The change-password form's fields: current, new, confirm. */
const CHANGE_PASSWORD_FIELDS = 3;
/** The rotate-2FA form's fields: password, current authenticator code. */
const ROTATE_FIELDS = 2;

interface SectionSkeletonProps {
	readonly className?: string;
	readonly children: ReactNode;
}

/** One `<section>` card of the panel: its `h2`, the description line, then the section's own body. */
function SectionSkeleton({ className, children }: SectionSkeletonProps): JSX.Element {
	return (
		<div data-slot="security-section-skeleton" className={cn("flex flex-col gap-4 rounded-xl border bg-card p-6", className)}>
			<div className="flex flex-col gap-2">
				<Skeleton variant="text" className="h-5 w-48 max-w-full" />
				<Skeleton variant="text" className="h-3.5 w-80 max-w-full" />
			</div>
			{children}
		</div>
	);
}

/**
 * `SecuritySettingsPanel`'s silhouette, section for section: email
 * verification, change password, two-factor authentication, signed-in devices
 * and MFA recovery, in the panel's own two-column grid. Bones only — wrap it
 * in one `SkeletonRegion` (a route's `loading.tsx` does).
 */
export function SecuritySettingsPanelSkeleton(): JSX.Element {
	return (
		<div data-slot="security-settings-panel-skeleton" className="grid gap-8 lg:grid-cols-2">
			<SectionSkeleton className="lg:col-span-2">
				<div className="flex flex-col gap-3">
					<Skeleton variant="text" className="h-4 w-32" />
					<Skeleton variant="text" className="h-3.5 w-64 max-w-full" />
					<Skeleton className="h-9 w-48" />
				</div>
			</SectionSkeleton>
			<SectionSkeleton>
				<FormSkeleton surface="plain" fields={CHANGE_PASSWORD_FIELDS} withActions={false} />
				<Skeleton className="h-11 w-full" />
			</SectionSkeleton>
			<SectionSkeleton>
				<Skeleton className="h-9 w-52" />
				<div className="flex flex-col gap-4 border-t pt-6">
					<div className="flex flex-col gap-2">
						<Skeleton variant="text" className="h-4 w-56 max-w-full" />
						<Skeleton variant="text" className="h-3.5 w-full" />
					</div>
					<FormSkeleton surface="plain" fields={ROTATE_FIELDS} withActions={false} />
					<Skeleton className="h-9 w-28" />
				</div>
			</SectionSkeleton>
			<SectionSkeleton className="lg:col-span-2">
				<SignedInDevicesSkeleton />
			</SectionSkeleton>
			<SectionSkeleton className="lg:col-span-2">
				<Skeleton className="h-16 w-full rounded-lg" />
			</SectionSkeleton>
		</div>
	);
}
