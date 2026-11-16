import { Skeleton } from "@workspace/ui/components/skeleton";
import type * as React from "react";

/** How many feature blocks the loading state of a component page draws. */
const FEATURE_SET_PLACEHOLDERS = 2;
const PLACEHOLDER_KEYS: readonly string[] = Array.from({ length: FEATURE_SET_PLACEHOLDERS }, (_, position: number): string => `feature-${String(position)}`);

/** Shown while one feature's live example downloads. */
export function FeatureLoading(): React.JSX.Element {
	return <Skeleton data-slot="feature-loading" className="h-40 w-full" />;
}

/** Shown while a component's features module downloads: blocks shaped like the features to come. */
export function FeatureSetLoading(): React.JSX.Element {
	return (
		<div data-slot="feature-set-loading" className="flex flex-col gap-8">
			{PLACEHOLDER_KEYS.map((key: string): React.JSX.Element => (
				<div key={key} className="flex flex-col gap-1 rounded-xl border bg-muted/50 p-1">
					<Skeleton variant="text" className="mx-4 my-2 h-5 w-40" />
					<Skeleton className="h-40 w-full rounded-lg" />
					<Skeleton className="h-64 w-full rounded-lg" />
				</div>
			))}
		</div>
	);
}
