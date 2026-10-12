import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { FormSkeleton } from "@workspace/ui/components/skeleton-patterns";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import * as React from "react";

export interface AuthFormSkeletonProps {
	/** How many label + input pairs the form has. */
	readonly fields: number;
	/** What the region announces — name the form ("Loading sign-in…"). */
	readonly labels: UiKitLabelsOverride<"skeletonRegion">;
}

/**
 * An auth form inside `AuthLayout`'s card while it loads: the `h-11` fields,
 * then the full-width `h-11` submit button the auth `FormShell` draws.
 */
export function AuthFormSkeleton({ fields, labels }: AuthFormSkeletonProps): React.JSX.Element {
	return (
		<SkeletonRegion labels={labels} className="flex flex-col gap-6">
			<FormSkeleton surface="plain" fields={fields} inputSize="lg" withActions={false} />
			<Skeleton className="h-11 w-full" />
		</SkeletonRegion>
	);
}

export interface AuthStatusLineSkeletonProps {
	readonly labels: UiKitLabelsOverride<"skeletonRegion">;
}

/** A centred one-line status in `AuthLayout`'s card ("Verifying your email…") while its page reads the link. */
export function AuthStatusLineSkeleton({ labels }: AuthStatusLineSkeletonProps): React.JSX.Element {
	return (
		<SkeletonRegion labels={labels} className="flex justify-center">
			<Skeleton variant="text" className="my-0.5 h-4 w-48" />
		</SkeletonRegion>
	);
}
