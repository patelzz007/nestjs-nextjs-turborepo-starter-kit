"use client";

import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { FormSkeleton } from "@workspace/ui/components/skeleton-patterns";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import type { JSX } from "react";

/** What the form announces while the reset link is checked. */
export const RESET_PASSWORD_FORM_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Checking your reset link…" };

/** The form's fields: new password, confirm password. */
const RESET_PASSWORD_FIELDS = 2;

/**
 * `ResetPasswordForm`'s silhouette — its two password fields, the full-width
 * submit and the "Back to sign in" link — while the reset link is validated
 * (and as a page's Suspense fallback while the link's token is read).
 */
export function ResetPasswordFormSkeleton(): JSX.Element {
	return (
		<SkeletonRegion labels={RESET_PASSWORD_FORM_LOADING_LABELS} className="flex flex-col gap-4">
			<FormSkeleton surface="plain" fields={RESET_PASSWORD_FIELDS} withActions={false} />
			<Skeleton className="h-11 w-full" />
			<Skeleton variant="text" className="mx-auto h-3.5 w-28" />
		</SkeletonRegion>
	);
}
