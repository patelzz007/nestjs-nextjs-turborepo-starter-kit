"use client";

import { Skeleton } from "@workspace/ui/components/skeleton";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import type { JSX } from "react";

import { placeholderKeys } from "@workspace/ui/lib/skeleton/placeholders";
import { MERCHANT_KYB_UPDATE_STEPS } from "./verification-update-section";

/** What the verification view announces while the KYB profile loads. */
export const MERCHANT_KYB_VERIFICATION_LOADING_LABELS: UiKitLabelsOverride<"skeletonRegion"> = { loading: "Loading business verification…" };

/** One-line inputs of the first (business) step around the address box: business name, legal name — then contact phone. */
const LEADING_INPUT_FIELDS = 2;
/** Field-label widths, so the labels read as different words. */
const LABEL_WIDTHS: readonly string[] = ["w-28", "w-40", "w-32"];

function InputFieldSkeleton({ labelWidth }: { readonly labelWidth: string }): JSX.Element {
	return (
		<div className="flex flex-col gap-2">
			<Skeleton variant="text" className={`h-3.5 ${labelWidth}`} />
			<Skeleton className="h-11 w-full" />
		</div>
	);
}

/**
 * The verification form's silhouette as it first opens (not yet approved, on
 * the business step): the status line, the step progress, the business fields
 * and the full-width "Continue" button. Bones only — wrap it in one `SkeletonRegion`.
 */
export function MerchantKybVerificationSkeleton(): JSX.Element {
	return (
		<div data-slot="kyb-verification-skeleton" className="flex flex-col gap-6">
			<Skeleton variant="text" className="h-3.5 w-full max-w-2xl" />
			<div className="flex flex-col gap-2">
				<div className="flex items-baseline justify-between gap-3">
					<Skeleton variant="text" className="h-3.5 w-24" />
					<Skeleton variant="text" className="h-3 w-10" />
				</div>
				<div className="flex gap-1">
					{placeholderKeys("step", MERCHANT_KYB_UPDATE_STEPS.length).map((key): JSX.Element => (
						<Skeleton key={key} data-slot="kyb-step-skeleton" className="h-1 flex-1 rounded-full" />
					))}
				</div>
			</div>
			<div className="flex flex-col gap-4">
				{placeholderKeys("input", LEADING_INPUT_FIELDS).map((key, index): JSX.Element => (
					<InputFieldSkeleton key={key} labelWidth={LABEL_WIDTHS[index % LABEL_WIDTHS.length] ?? "w-32"} />
				))}
				<div className="flex flex-col gap-2">
					<Skeleton variant="text" className="h-3.5 w-32" />
					<Skeleton className="h-20 w-full" />
				</div>
				<InputFieldSkeleton labelWidth="w-28" />
				<Skeleton className="h-11 w-full" />
			</div>
		</div>
	);
}
