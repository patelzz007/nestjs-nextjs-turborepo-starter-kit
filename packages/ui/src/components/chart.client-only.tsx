"use client";

import type { ChartContainer } from "@workspace/ui/components/chart";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { SkeletonRegion } from "@workspace/ui/components/skeleton-region";
import { cn } from "@workspace/ui/lib/core/utils";
import dynamic from "next/dynamic";
import * as React from "react";

export type ChartContainerClientOnlyProps = React.ComponentProps<typeof ChartContainer>;

/** The sizing the container's own box gets (its `aspect-video` default plus the caller's classes): `next/dynamic` hands its `loading` fallback no props, so it travels by context. */
const ChartSkeletonClassNameContext = React.createContext<string | undefined>(undefined);

/**
 * The chart's box while recharts loads — and its server output: one bone at
 * exactly the container's size (`ChartContainer`'s `flex aspect-video`, then
 * the caller's sizing classes, e.g. `aspect-auto h-[250px] w-full`).
 */
function ChartContainerSkeleton(): React.JSX.Element {
	const className = React.useContext(ChartSkeletonClassNameContext);
	return (
		<SkeletonRegion data-slot="chart-skeleton" className={cn("flex aspect-video", className)}>
			<Skeleton className="size-full rounded-lg" />
		</SkeletonRegion>
	);
}

function renderChartContainerSkeleton(): React.JSX.Element {
	return <ChartContainerSkeleton />;
}

const LazyChartContainer = dynamic(() => import("@workspace/ui/components/chart").then((module) => module.ChartContainer), {
	ssr: false,
	loading: renderChartContainerSkeleton,
});

/**
 * `ChartContainer` without recharts' container in the page's first bundle
 * (decision #65): the server renders a bone the container's size, and the
 * chart replaces it once its chunk loads. Same props, same chart. The split
 * pays off only when the recharts marks passed as children are not also
 * imported eagerly by the page (put the whole chart behind its own module).
 */
export default function ChartContainerClientOnly({ className, ...props }: ChartContainerClientOnlyProps): React.JSX.Element {
	return (
		<ChartSkeletonClassNameContext.Provider value={className}>
			<LazyChartContainer className={className} {...props} />
		</ChartSkeletonClassNameContext.Provider>
	);
}
