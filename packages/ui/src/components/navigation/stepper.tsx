import { cn } from "@workspace/ui/lib/core/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

/**
 * Compound progress timeline for a multi-step flow (a wizard, an application,
 * a checkout). Data-agnostic: the caller owns the steps, their labels and
 * which one is current — every part here only renders a `status` it is given.
 *
 * ```tsx
 * <Stepper aria-label="Application progress">
 *   <StepperItem status="complete">
 *     <StepperTrigger onClick={goToBusiness}>
 *       <StepperIndicator><Check /></StepperIndicator>
 *       <StepperContent>
 *         <StepperTitle>Business</StepperTitle>
 *         <StepperDescription>Legal name and category</StepperDescription>
 *       </StepperContent>
 *     </StepperTrigger>
 *   </StepperItem>
 *   <StepperItem status="current">
 *     <StepperStep>…</StepperStep>
 *   </StepperItem>
 * </Stepper>
 * ```
 *
 * The connector between two items is drawn by the earlier item, and takes the
 * primary colour once that item is complete — so the line "fills" as the flow
 * advances. Its geometry follows `--stepper-indicator-size` (set by `size`) and
 * `--stepper-connector-gap` (the space between a connector and an indicator).
 */
export type StepperItemStatus = "complete" | "current" | "upcoming";

const stepperVariants = cva("group/stepper flex [--stepper-connector-gap:--spacing(1.5)]", {
	variants: {
		orientation: {
			vertical: "flex-col",
			horizontal: "w-full flex-row items-start",
		},
		size: {
			sm: "[--stepper-indicator-size:--spacing(6)]",
			md: "[--stepper-indicator-size:--spacing(8)]",
		},
	},
	defaultVariants: {
		orientation: "vertical",
		size: "md",
	},
});

type StepperProps = React.ComponentProps<"ol"> & VariantProps<typeof stepperVariants>;

const Stepper = React.forwardRef<HTMLOListElement, StepperProps>(function Stepper({ className, orientation = "vertical", size = "md", ...props }, ref): React.JSX.Element {
	return <ol ref={ref} data-slot="stepper" data-orientation={orientation} className={cn(stepperVariants({ orientation, size }), className)} {...props} />;
});

/**
 * One step. The connector to the next step is the `before:` pseudo-element:
 * vertical runs from below this indicator to above the next one; horizontal
 * runs from this indicator's right edge to the next one's left edge (items
 * share the row equally, so the next centre is exactly one item-width away).
 */
const stepperItemClassName = [
	"group/stepper-item relative min-w-0 before:pointer-events-none before:absolute before:rounded-full before:bg-border before:transition-colors before:duration-300 last:before:hidden motion-reduce:before:transition-none",
	"data-[status=complete]:before:bg-primary",
	"group-data-[orientation=vertical]/stepper:pb-6 group-data-[orientation=vertical]/stepper:last:pb-0",
	"group-data-[orientation=vertical]/stepper:before:top-[calc(var(--stepper-indicator-size)+var(--stepper-connector-gap))] group-data-[orientation=vertical]/stepper:before:bottom-(--stepper-connector-gap) group-data-[orientation=vertical]/stepper:before:left-[calc(var(--stepper-indicator-size)/2)] group-data-[orientation=vertical]/stepper:before:w-0.5 group-data-[orientation=vertical]/stepper:before:-translate-x-1/2",
	"group-data-[orientation=horizontal]/stepper:flex-1",
	"group-data-[orientation=horizontal]/stepper:before:top-[calc(var(--stepper-indicator-size)/2)] group-data-[orientation=horizontal]/stepper:before:left-[calc(50%+var(--stepper-indicator-size)/2+var(--stepper-connector-gap))] group-data-[orientation=horizontal]/stepper:before:h-0.5 group-data-[orientation=horizontal]/stepper:before:w-[calc(100%-var(--stepper-indicator-size)-2*var(--stepper-connector-gap))] group-data-[orientation=horizontal]/stepper:before:-translate-y-1/2",
].join(" ");

interface StepperItemProps extends React.ComponentProps<"li"> {
	readonly status: StepperItemStatus;
}

const StepperItem = React.forwardRef<HTMLLIElement, StepperItemProps>(function StepperItem({ className, status, ...props }, ref): React.JSX.Element {
	return (
		<li
			ref={ref}
			data-slot="stepper-item"
			data-status={status}
			aria-current={status === "current" ? "step" : undefined}
			className={cn(stepperItemClassName, className)}
			{...props}
		/>
	);
});

/** The row inside an item: indicator beside (vertical) or above (horizontal) the content. */
const stepperStepClassName =
	"flex w-full min-w-0 gap-3 text-start group-data-[orientation=horizontal]/stepper:flex-col group-data-[orientation=horizontal]/stepper:items-center group-data-[orientation=horizontal]/stepper:gap-2 group-data-[orientation=horizontal]/stepper:text-center";

/** A non-interactive step row. */
const StepperStep = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function StepperStep({ className, ...props }, ref): React.JSX.Element {
	return <div ref={ref} data-slot="stepper-step" className={cn(stepperStepClassName, className)} {...props} />;
});

/** A step row the user can activate (e.g. to revisit a completed step). */
const StepperTrigger = React.forwardRef<HTMLButtonElement, React.ComponentProps<"button">>(function StepperTrigger(
	{ className, type = "button", ...props },
	ref,
): React.JSX.Element {
	return (
		<button
			ref={ref}
			type={type}
			data-slot="stepper-trigger"
			className={cn(
				stepperStepClassName,
				"group/stepper-trigger cursor-pointer rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	);
});

const StepperIndicator = React.forwardRef<HTMLSpanElement, React.ComponentProps<"span">>(function StepperIndicator({ className, ...props }, ref): React.JSX.Element {
	return (
		<span
			ref={ref}
			data-slot="stepper-indicator"
			aria-hidden="true"
			className={cn(
				"relative flex size-(--stepper-indicator-size) shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-[color,background-color,border-color,box-shadow] duration-300 motion-reduce:transition-none [&_svg:not([class*='size-'])]:size-3.5",
				"group-data-[status=upcoming]/stepper-item:border-border group-data-[status=upcoming]/stepper-item:bg-background group-data-[status=upcoming]/stepper-item:text-muted-foreground",
				"group-data-[status=current]/stepper-item:border-primary group-data-[status=current]/stepper-item:bg-primary/10 group-data-[status=current]/stepper-item:text-primary group-data-[status=current]/stepper-item:ring-4 group-data-[status=current]/stepper-item:ring-primary/15",
				"group-data-[status=complete]/stepper-item:border-primary group-data-[status=complete]/stepper-item:bg-primary group-data-[status=complete]/stepper-item:text-primary-foreground",
				"group-hover/stepper-trigger:group-data-[status=complete]/stepper-item:ring-4 group-hover/stepper-trigger:group-data-[status=complete]/stepper-item:ring-primary/15",
				className,
			)}
			{...props}
		/>
	);
});

const StepperContent = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function StepperContent({ className, ...props }, ref): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="stepper-content"
			className={cn(
				"flex min-w-0 flex-col gap-0.5 group-data-[orientation=vertical]/stepper:min-h-(--stepper-indicator-size) group-data-[orientation=vertical]/stepper:justify-center",
				className,
			)}
			{...props}
		/>
	);
});

const StepperTitle = React.forwardRef<HTMLSpanElement, React.ComponentProps<"span">>(function StepperTitle({ className, ...props }, ref): React.JSX.Element {
	return (
		<span
			ref={ref}
			data-slot="stepper-title"
			className={cn(
				"text-sm leading-snug font-medium transition-colors",
				"group-data-[status=complete]/stepper-item:text-foreground group-data-[status=current]/stepper-item:text-foreground group-data-[status=upcoming]/stepper-item:text-muted-foreground",
				"group-hover/stepper-trigger:underline group-hover/stepper-trigger:underline-offset-4",
				className,
			)}
			{...props}
		/>
	);
});

const StepperDescription = React.forwardRef<HTMLSpanElement, React.ComponentProps<"span">>(function StepperDescription({ className, ...props }, ref): React.JSX.Element {
	return <span ref={ref} data-slot="stepper-description" className={cn("text-xs leading-snug text-muted-foreground", className)} {...props} />;
});

export { Stepper, StepperItem, StepperStep, StepperTrigger, StepperIndicator, StepperContent, StepperTitle, StepperDescription, stepperVariants };
