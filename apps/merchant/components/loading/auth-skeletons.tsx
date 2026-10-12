"use client";

import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { FormSkeleton } from "@workspace/ui/components/skeleton-patterns";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import * as React from "react";

/** What an auth page announces while it loads. */
export const MERCHANT_AUTH_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading sign-in…" };
/** What the verify-email page announces while it reads its link. */
export const VERIFY_EMAIL_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Verifying your email…" };

/** Feature bullets on the brand panel of every auth page. */
const BRAND_FEATURES = 3;
/** The sign-in form's fields: email, password. */
const AUTH_FORM_FIELDS = 2;

/**
 * An auth page (`AuthLayout`) while its route loads: the brand panel on the
 * left (desktop), then the theme toggle, the centered title and a two-field
 * form with its full-width submit — the shape every merchant auth page shares.
 */
export function MerchantAuthPageSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={MERCHANT_AUTH_LOADING_LABELS} className="flex min-h-svh bg-background md:h-svh md:max-h-svh md:overflow-hidden">
			<div data-slot="auth-brand-skeleton" className="hidden flex-col items-center justify-center gap-8 bg-auth-panel px-8 md:flex md:w-1/2 dark:bg-auth-panel/90">
				<Skeleton className="size-20 rounded-2xl bg-auth-panel-foreground/10" />
				<div className="flex flex-col items-center gap-4">
					<Skeleton className="h-8 w-56 bg-auth-panel-foreground/10" />
					<Skeleton variant="text" className="h-4 w-80 max-w-full bg-auth-panel-foreground/10" />
				</div>
				<div className="flex flex-col gap-3">
					{placeholderKeys("feature", BRAND_FEATURES).map((key): React.JSX.Element => (
						<div key={key} className="flex items-center gap-3">
							<Skeleton variant="circular" className="size-2 bg-auth-panel-foreground/10" />
							<Skeleton variant="text" className="h-3.5 w-52 bg-auth-panel-foreground/10" />
						</div>
					))}
				</div>
			</div>
			<div className="flex min-h-svh w-full flex-col md:min-h-0 md:w-1/2">
				<div className="flex items-center justify-between p-6">
					<Skeleton className="size-8 rounded-lg md:hidden" />
					<Skeleton className="ml-auto size-9 rounded-md" />
				</div>
				<div className="flex flex-1 flex-col px-6 py-8">
					<div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8">
						<div className="flex flex-col items-center gap-3">
							<Skeleton className="h-7 w-48" />
							<Skeleton variant="text" className="h-4 w-64 max-w-full" />
						</div>
						<div className="flex flex-col gap-4">
							<FormSkeleton surface="plain" fields={AUTH_FORM_FIELDS} withActions={false} />
							<Skeleton className="h-11 w-full" />
						</div>
					</div>
				</div>
			</div>
		</SkeletonRegion>
	);
}

/** The verify-email view's first frame — one centered status line — while the page reads its link. */
export function VerifyEmailStatusSkeleton(): React.JSX.Element {
	return (
		<SkeletonRegion labels={VERIFY_EMAIL_LOADING_LABELS} className="flex justify-center">
			<Skeleton variant="text" className="h-3.5 w-48" />
		</SkeletonRegion>
	);
}
