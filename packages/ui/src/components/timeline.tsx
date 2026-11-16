"use client";

// Ported from ReUI (https://reui.io/r/base-vega/timeline.json). Part names,
// props (`value` / `defaultValue` / `onValueChange`, `orientation`, `step`,
// `render`) and `data-slot` attributes match ReUI, so its examples apply, with
// these deliberate deviations:
// - Every part forwards its ref (through base-ui's `useRender`).
// - The context value is memoised, so items do not re-render on every parent
//   render.
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

export type TimelineOrientation = "horizontal" | "vertical";

interface TimelineContextValue {
	readonly activeStep: number;
	readonly setActiveStep: (step: number) => void;
}

const TimelineContext = React.createContext<TimelineContextValue | null>(null);

function useTimeline(): TimelineContextValue {
	const context = React.useContext(TimelineContext);
	if (context === null) {
		throw new Error("useTimeline must be used within a Timeline");
	}
	return context;
}

/** The active step when neither `value` nor `defaultValue` is given (steps are 1-based). */
const DEFAULT_TIMELINE_STEP = 1;

interface TimelineProps extends useRender.ComponentProps<"div"> {
	/** The initially active step, uncontrolled (1-based, matching `TimelineItem step`). */
	readonly defaultValue?: number | undefined;
	/** The active step, controlled. Items up to and including it render as completed. */
	readonly value?: number | undefined;
	/** Callback fired when the active step changes. */
	readonly onValueChange?: ((value: number) => void) | undefined;
	/** The layout orientation of the timeline. */
	readonly orientation?: TimelineOrientation | undefined;
}

/** Events along a line, vertical or horizontal. Items up to `value` are marked completed. */
const Timeline = React.forwardRef<HTMLDivElement, TimelineProps>(function Timeline(
	{ defaultValue = DEFAULT_TIMELINE_STEP, value, onValueChange, orientation = "vertical", className, render, children, ...props },
	ref,
): React.ReactElement {
	const [internalStep, setInternalStep] = React.useState(defaultValue);

	const setActiveStep = React.useCallback(
		(step: number): void => {
			if (value === undefined) {
				setInternalStep(step);
			}
			onValueChange?.(step);
		},
		[value, onValueChange],
	);

	const activeStep = value ?? internalStep;
	const contextValue = React.useMemo<TimelineContextValue>(() => ({ activeStep, setActiveStep }), [activeStep, setActiveStep]);

	const element = useRender({
		ref,
		defaultTagName: "div",
		render,
		props: mergeProps<"div">(
			{
				className: cn("group/timeline flex data-[orientation=horizontal]:w-full data-[orientation=horizontal]:flex-row data-[orientation=vertical]:flex-col", className),
				children,
			},
			props,
		),
		state: { slot: "timeline", orientation },
	});

	return <TimelineContext.Provider value={contextValue}>{element}</TimelineContext.Provider>;
});

/** The event's body text. */
const TimelineContent = React.forwardRef<HTMLDivElement, useRender.ComponentProps<"div">>(function TimelineContent(
	{ className, render, children, ...props },
	ref,
): React.ReactElement {
	return useRender({
		ref,
		defaultTagName: "div",
		render,
		props: mergeProps<"div">({ className: cn("text-sm text-muted-foreground", className), children }, props),
		state: { slot: "timeline-content" },
	});
});

type TimelineDateProps = useRender.ComponentProps<"time">;

/** When the event happened. */
const TimelineDate = React.forwardRef<HTMLTimeElement, TimelineDateProps>(function TimelineDate({ className, render, children, ...props }, ref): React.ReactElement {
	return useRender({
		ref,
		defaultTagName: "time",
		render,
		props: mergeProps<"time">(
			{
				className: cn("mb-1 block text-xs font-medium text-muted-foreground group-data-[orientation=vertical]/timeline:max-sm:h-4", className),
				children,
			},
			props,
		),
		state: { slot: "timeline-date" },
	});
});

/** Groups the date and the title. */
const TimelineHeader = React.forwardRef<HTMLDivElement, useRender.ComponentProps<"div">>(function TimelineHeader(
	{ className, render, children, ...props },
	ref,
): React.ReactElement {
	return useRender({
		ref,
		defaultTagName: "div",
		render,
		props: mergeProps<"div">({ className: cn(className), children }, props),
		state: { slot: "timeline-header" },
	});
});

type TimelineIndicatorProps = useRender.ComponentProps<"div">;

/** The marker on the line; holds an icon, an avatar or nothing. */
const TimelineIndicator = React.forwardRef<HTMLDivElement, TimelineIndicatorProps>(function TimelineIndicator(
	{ className, children, render, ...props },
	ref,
): React.ReactElement {
	return useRender({
		ref,
		defaultTagName: "div",
		render,
		props: mergeProps<"div">(
			{
				"aria-hidden": true,
				className: cn(
					"absolute size-4 rounded-full border-2 border-primary/20 group-data-completed/timeline-item:border-primary group-data-[orientation=horizontal]/timeline:-top-6 group-data-[orientation=horizontal]/timeline:left-0 group-data-[orientation=horizontal]/timeline:-translate-y-1/2 group-data-[orientation=vertical]/timeline:top-0 group-data-[orientation=vertical]/timeline:-left-6 group-data-[orientation=vertical]/timeline:-translate-x-1/2",
					className,
				),
				children,
			},
			props,
		),
		state: { slot: "timeline-indicator" },
	});
});

interface TimelineItemProps extends useRender.ComponentProps<"div"> {
	/** This item's 1-based position; it is completed once the active step reaches it. */
	readonly step: number;
}

/** One event, identified by its `step`. Keep it a direct child of `Timeline`. */
const TimelineItem = React.forwardRef<HTMLDivElement, TimelineItemProps>(function TimelineItem({ step, className, render, children, ...props }, ref): React.ReactElement {
	const { activeStep } = useTimeline();

	return useRender({
		ref,
		defaultTagName: "div",
		render,
		props: mergeProps<"div">(
			{
				className: cn(
					"group/timeline-item relative flex flex-1 flex-col gap-0.5 group-data-[orientation=horizontal]/timeline:mt-8 group-data-[orientation=horizontal]/timeline:not-last:pe-8 group-data-[orientation=vertical]/timeline:ms-8 group-data-[orientation=vertical]/timeline:not-last:pb-6 has-[+[data-completed]]:**:data-[slot=timeline-separator]:bg-primary",
					className,
				),
				children,
			},
			props,
		),
		state: { slot: "timeline-item", completed: step <= activeStep },
	});
});

/** The line to the next event, hidden on the last one. */
const TimelineSeparator = React.forwardRef<HTMLDivElement, useRender.ComponentProps<"div">>(function TimelineSeparator(
	{ className, render, children, ...props },
	ref,
): React.ReactElement {
	return useRender({
		ref,
		defaultTagName: "div",
		render,
		props: mergeProps<"div">(
			{
				"aria-hidden": true,
				className: cn(
					"absolute self-start bg-primary/10 group-last/timeline-item:hidden group-data-[orientation=horizontal]/timeline:-top-6 group-data-[orientation=horizontal]/timeline:h-0.5 group-data-[orientation=horizontal]/timeline:w-[calc(100%-1rem-0.25rem)] group-data-[orientation=horizontal]/timeline:translate-x-4.5 group-data-[orientation=horizontal]/timeline:-translate-y-1/2 group-data-[orientation=vertical]/timeline:-left-6 group-data-[orientation=vertical]/timeline:h-[calc(100%-1rem-0.25rem)] group-data-[orientation=vertical]/timeline:w-0.5 group-data-[orientation=vertical]/timeline:-translate-x-1/2 group-data-[orientation=vertical]/timeline:translate-y-4.5",
					className,
				),
				children,
			},
			props,
		),
		state: { slot: "timeline-separator" },
	});
});

/** What happened. */
const TimelineTitle = React.forwardRef<HTMLHeadingElement, useRender.ComponentProps<"h3">>(function TimelineTitle(
	{ className, render, children, ...props },
	ref,
): React.ReactElement {
	return useRender({
		ref,
		defaultTagName: "h3",
		render,
		props: mergeProps<"h3">({ className: cn("text-sm font-medium", className), children }, props),
		state: { slot: "timeline-title" },
	});
});

export { Timeline, TimelineContent, TimelineDate, TimelineHeader, TimelineIndicator, TimelineItem, TimelineSeparator, TimelineTitle };
export type { TimelineDateProps, TimelineIndicatorProps, TimelineItemProps, TimelineProps };
