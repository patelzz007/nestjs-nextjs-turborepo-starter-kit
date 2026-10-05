"use client";

import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@workspace/ui/components/display/card";
import { Button } from "@workspace/ui/components/form/button";
import { Skeleton } from "@workspace/ui/components/feedback/skeleton";
import { cn } from "@workspace/ui/lib/core/utils";
import { AlertCircle, ChartNoAxesColumn } from "lucide-react";
import * as React from "react";

/**
 * What a chart area shows — one state at a time. `ready` renders the chart;
 * the others replace it with a frame of the same height (no layout jump).
 */
export type ChartFrameState =
	| { readonly status: "ready" }
	| { readonly status: "loading" }
	| { readonly status: "empty"; readonly message: string }
	| { readonly status: "error"; readonly message: string; readonly retryLabel: string; readonly onRetry: () => void };

/** The ready state — a constant so call sites never build a new object per render. */
export const CHART_READY: ChartFrameState = { status: "ready" };

/** The loading state. */
export const CHART_LOADING: ChartFrameState = { status: "loading" };

const frameHeights = {
	sm: "min-h-40",
	md: "min-h-72",
} satisfies Record<string, string>;

export type ChartFrameHeight = keyof typeof frameHeights;

export interface ChartStateFrameProps {
	readonly state: ChartFrameState;
	readonly height?: ChartFrameHeight;
	/** Rendered only in the `ready` state. */
	readonly children: React.ReactNode;
}

/** Loading skeleton, empty message or error with retry in place of a chart — the chart renders only when `ready`. */
export function ChartStateFrame({ state, height = "md", children }: ChartStateFrameProps): React.JSX.Element {
	switch (state.status) {
		case "ready":
			return <>{children}</>;
		case "loading":
			return <Skeleton aria-hidden="true" className={cn("w-full rounded-lg", frameHeights[height])} />;
		case "empty":
			return (
				<div className={cn("flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-6 text-center", frameHeights[height])}>
					<ChartNoAxesColumn className="size-5 text-muted-foreground" aria-hidden="true" />
					<p className="max-w-sm text-sm text-muted-foreground">{state.message}</p>
				</div>
			);
		case "error":
			return (
				<div role="alert" className={cn("flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 p-6 text-center", frameHeights[height])}>
					<AlertCircle className="size-5 text-destructive" aria-hidden="true" />
					<p className="max-w-sm text-sm text-foreground">{state.message}</p>
					<Button type="button" variant="outline" size="sm" onClick={state.onRetry}>
						{state.retryLabel}
					</Button>
				</div>
			);
	}
}

export interface AnalyticsPanelProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
	readonly title: string;
	readonly description?: string | undefined;
	/** Controls in the header's corner (a table toggle, a link). */
	readonly actions?: React.ReactNode;
	readonly children: React.ReactNode;
}

/**
 * A titled dashboard section — one chart, list or table. A `<section>` named by
 * its heading, so assistive technology can jump between panels.
 */
export const AnalyticsPanel = React.forwardRef<HTMLElement, AnalyticsPanelProps>(function AnalyticsPanel(
	{ title, description, actions, children, className, ...props },
	ref,
): React.JSX.Element {
	const headingId = React.useId();
	return (
		<section ref={ref} aria-labelledby={headingId} className={cn("min-w-0", className)} {...props}>
			<Card className="h-full border-border/80 bg-card shadow-xs">
				<CardHeader>
					<h2 id={headingId} className="text-base leading-snug font-semibold text-foreground">
						{title}
					</h2>
					{description === undefined ? null : <CardDescription>{description}</CardDescription>}
					{actions === undefined ? null : <CardAction>{actions}</CardAction>}
				</CardHeader>
				<CardContent className="min-w-0">{children}</CardContent>
			</Card>
		</section>
	);
});
AnalyticsPanel.displayName = "AnalyticsPanel";
