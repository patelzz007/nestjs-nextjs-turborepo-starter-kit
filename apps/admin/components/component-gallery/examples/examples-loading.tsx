import { Skeleton } from "@workspace/ui/components/skeleton";
import type * as React from "react";

/** Shown while a component's examples chunk downloads. */
export function ExamplesLoading(): React.JSX.Element {
	return <Skeleton className="h-40 w-full" />;
}
