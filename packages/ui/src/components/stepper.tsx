"use client";

// Ported from ReUI (https://reui.io/r/base-vega/stepper.json). Part names, props,
// `data-slot` / `data-state` attributes and composition match ReUI, so its docs
// and examples apply, with these deliberate deviations:
// - Fully controlled: `value` is required and there is no `defaultValue`; the
//   parent owns the active step (and decides whether a trigger may change it).
// - Every part forwards its ref.
// - `role="tablist"` sits on `StepperNav`, not the root, so panels are not
//   nested inside the tablist; `StepperNav` is a `div` (a tablist role on a
//   `<nav>` landmark would override its landmark semantics); ids come from `useId`, so two steppers on one
//   page never collide; `StepperContent` is a `tabpanel` labelled by its tab.
// - Keyboard navigation queries the nav's enabled triggers instead of keeping
//   a registry of nodes in state, and the always-zero `stepsCount` is dropped.
// - `StepperIndicator` takes a `size` variant.
import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@workspace/ui/lib/core/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

export type StepperOrientation = "horizontal" | "vertical";
export type StepState = "active" | "completed" | "inactive" | "loading";

/** Content shown in an indicator per state, in place of its children. */
export interface StepIndicators {
	readonly active?: React.ReactNode;
	readonly completed?: React.ReactNode;
	readonly inactive?: React.ReactNode;
	readonly loading?: React.ReactNode;
}

interface StepperContextValue {
	readonly activeStep: number;
	readonly setActiveStep: (step: number) => void;
	readonly orientation: StepperOrientation;
	readonly indicators: StepIndicators;
	readonly baseId: string;
}

interface StepItemContextValue {
	readonly step: number;
	readonly state: StepState;
	readonly isDisabled: boolean;
	readonly isLoading: boolean;
}

const StepperContext = React.createContext<StepperContextValue | null>(null);
const StepItemContext = React.createContext<StepItemContextValue | null>(null);

function useStepper(): StepperContextValue {
	const context = React.useContext(StepperContext);
	if (context === null) {
		throw new Error("useStepper must be used within a Stepper");
	}
	return context;
}

function useStepItem(): StepItemContextValue {
	const context = React.useContext(StepItemContext);
	if (context === null) {
		throw new Error("useStepItem must be used within a StepperItem");
	}
	return context;
}

const NO_INDICATORS: StepIndicators = {};

interface StepperProps extends React.ComponentProps<"div"> {
	/** The active step (1-based, matching `StepperItem step`). */
	readonly value: number;
	/** Called with the step a trigger asks for; omit it to make triggers inert. */
	readonly onValueChange?: ((value: number) => void) | undefined;
	readonly orientation?: StepperOrientation | undefined;
	readonly indicators?: StepIndicators | undefined;
}

const Stepper = React.forwardRef<HTMLDivElement, StepperProps>(function Stepper(
	{ value, onValueChange, orientation = "horizontal", indicators = NO_INDICATORS, className, children, ...props },
	ref,
): React.JSX.Element {
	const baseId = React.useId();

	const setActiveStep = React.useCallback(
		(step: number): void => {
			onValueChange?.(step);
		},
		[onValueChange],
	);

	const contextValue = React.useMemo<StepperContextValue>(
		() => ({ activeStep: value, setActiveStep, orientation, indicators, baseId }),
		[value, setActiveStep, orientation, indicators, baseId],
	);

	return (
		<StepperContext.Provider value={contextValue}>
			<div ref={ref} data-slot="stepper" data-orientation={orientation} className={cn("w-full", className)} {...props}>
				{children}
			</div>
		</StepperContext.Provider>
	);
});

interface StepperItemProps extends React.ComponentProps<"div"> {
	/** This step's 1-based position. */
	readonly step: number;
	/** Marks the step completed regardless of the active step. */
	readonly completed?: boolean | undefined;
	readonly disabled?: boolean | undefined;
	/** Shows the loading indicator while this step is active. */
	readonly loading?: boolean | undefined;
}

function stepStateFor(step: number, activeStep: number, completed: boolean): StepState {
	if (completed || step < activeStep) {
		return "completed";
	}
	return step === activeStep ? "active" : "inactive";
}

const StepperItem = React.forwardRef<HTMLDivElement, StepperItemProps>(function StepperItem(
	{ step, completed = false, disabled = false, loading = false, className, children, ...props },
	ref,
): React.JSX.Element {
	const { activeStep } = useStepper();
	const state = stepStateFor(step, activeStep, completed);
	const isLoading = loading && step === activeStep;

	const itemContext = React.useMemo<StepItemContextValue>(() => ({ step, state, isDisabled: disabled, isLoading }), [step, state, disabled, isLoading]);

	return (
		<StepItemContext.Provider value={itemContext}>
			<div
				ref={ref}
				data-slot="stepper-item"
				data-state={state}
				data-loading={isLoading ? true : undefined}
				className={cn(
					"group/step flex items-center justify-center not-last:flex-1 group-data-[orientation=horizontal]/stepper-nav:flex-row group-data-[orientation=vertical]/stepper-nav:flex-col",
					className,
				)}
				{...props}>
				{children}
			</div>
		</StepItemContext.Provider>
	);
});

function tabId(baseId: string, step: number): string {
	return `${baseId}-tab-${String(step)}`;
}

function panelId(baseId: string, step: number): string {
	return `${baseId}-panel-${String(step)}`;
}

/** The nav's enabled triggers, in document order. */
function navTriggers(trigger: HTMLElement): HTMLButtonElement[] {
	const nav = trigger.closest('[data-slot="stepper-nav"]');
	return nav === null ? [] : Array.from(nav.querySelectorAll<HTMLButtonElement>('[data-slot="stepper-trigger"]:not(:disabled)'));
}

/** Arrow keys move focus between triggers (wrapping), Home/End jump to the ends. */
function focusSiblingTrigger(trigger: HTMLElement, key: string): boolean {
	const triggers = navTriggers(trigger);
	if (triggers.length === 0) {
		return false;
	}
	const currentIndex = triggers.findIndex((candidate) => candidate === trigger);
	const lastIndex = triggers.length - 1;
	let targetIndex: number;
	switch (key) {
		case "ArrowRight":
		case "ArrowDown":
			targetIndex = currentIndex === lastIndex ? 0 : currentIndex + 1;
			break;
		case "ArrowLeft":
		case "ArrowUp":
			targetIndex = currentIndex <= 0 ? lastIndex : currentIndex - 1;
			break;
		case "Home":
			targetIndex = 0;
			break;
		case "End":
			targetIndex = lastIndex;
			break;
		default:
			return false;
	}
	triggers[targetIndex]?.focus();
	return true;
}

type StepperTriggerProps = useRender.ComponentProps<"button">;

const StepperTrigger = React.forwardRef<HTMLButtonElement, StepperTriggerProps>(function StepperTrigger(
	{ className, children, tabIndex, render, ...props },
	ref,
): React.ReactElement {
	const { step, state, isDisabled, isLoading } = useStepItem();
	const { activeStep, setActiveStep, baseId } = useStepper();
	const isSelected = activeStep === step;

	const handleClick = React.useCallback((): void => {
		setActiveStep(step);
	}, [setActiveStep, step]);

	const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLButtonElement>): void => {
		if (focusSiblingTrigger(event.currentTarget, event.key)) {
			event.preventDefault();
		}
	}, []);

	return useRender({
		ref,
		defaultTagName: "button",
		render,
		props: mergeProps<"button">(
			{
				type: "button",
				role: "tab",
				id: tabId(baseId, step),
				"aria-selected": isSelected,
				tabIndex: tabIndex ?? (isSelected ? 0 : -1),
				disabled: isDisabled,
				className: cn(
					"inline-flex cursor-pointer items-center gap-2.5 rounded-full outline-none focus-visible:z-10 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60",
					className,
				),
				onClick: handleClick,
				onKeyDown: handleKeyDown,
				children,
			},
			props,
		),
		state: {
			slot: "stepper-trigger",
			state,
			loading: isLoading,
		},
	});
});

const stepperIndicatorVariants = cva(
	"relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border-background bg-accent text-accent-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=completed]:bg-primary data-[state=completed]:text-primary-foreground",
	{
		variants: {
			size: {
				sm: "size-6 text-xs",
				md: "size-8 text-sm",
			},
		},
		defaultVariants: {
			size: "sm",
		},
	},
);

/** The custom indicator for the item's state, if the root supplied one. */
function indicatorFor(indicators: StepIndicators, state: StepState, isLoading: boolean): React.ReactNode {
	if (isLoading && indicators.loading !== undefined) {
		return indicators.loading;
	}
	return indicators[state];
}

interface StepperIndicatorProps extends React.ComponentProps<"div">, VariantProps<typeof stepperIndicatorVariants> {}

const StepperIndicator = React.forwardRef<HTMLDivElement, StepperIndicatorProps>(function StepperIndicator({ children, className, size, ...props }, ref): React.JSX.Element {
	const { state, isLoading } = useStepItem();
	const { indicators } = useStepper();
	const custom = indicatorFor(indicators, state, isLoading);

	return (
		<div ref={ref} data-slot="stepper-indicator" data-state={state} aria-hidden="true" className={cn(stepperIndicatorVariants({ size }), className)} {...props}>
			<div className="absolute">{custom ?? children}</div>
		</div>
	);
});

const StepperSeparator = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function StepperSeparator({ className, ...props }, ref): React.JSX.Element {
	const { state } = useStepItem();

	return (
		<div
			ref={ref}
			data-slot="stepper-separator"
			data-state={state}
			aria-hidden="true"
			className={cn(
				"m-0.5 rounded-sm bg-muted group-data-[orientation=horizontal]/stepper-nav:h-0.5 group-data-[orientation=horizontal]/stepper-nav:flex-1 group-data-[orientation=vertical]/stepper-nav:h-12 group-data-[orientation=vertical]/stepper-nav:w-0.5",
				className,
			)}
			{...props}
		/>
	);
});

const StepperTitle = React.forwardRef<HTMLHeadingElement, React.ComponentProps<"h3">>(function StepperTitle({ className, children, ...props }, ref): React.JSX.Element {
	const { state } = useStepItem();

	return (
		<h3 ref={ref} data-slot="stepper-title" data-state={state} className={cn("text-sm leading-none font-medium", className)} {...props}>
			{children}
		</h3>
	);
});

const StepperDescription = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function StepperDescription({ className, ...props }, ref): React.JSX.Element {
	const { state } = useStepItem();

	return <div ref={ref} data-slot="stepper-description" data-state={state} className={cn("text-sm text-muted-foreground", className)} {...props} />;
});

const StepperNav = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function StepperNav({ className, ...props }, ref): React.JSX.Element {
	const { activeStep, orientation } = useStepper();

	return (
		<div
			ref={ref}
			role="tablist"
			aria-orientation={orientation}
			data-slot="stepper-nav"
			data-state={activeStep}
			data-orientation={orientation}
			className={cn(
				"group/stepper-nav inline-flex data-[orientation=horizontal]:w-full data-[orientation=horizontal]:flex-row data-[orientation=vertical]:flex-col",
				className,
			)}
			{...props}
		/>
	);
});

const StepperPanel = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function StepperPanel({ className, ...props }, ref): React.JSX.Element {
	const { activeStep } = useStepper();

	return <div ref={ref} data-slot="stepper-panel" data-state={activeStep} className={cn("w-full", className)} {...props} />;
});

interface StepperContentProps extends React.ComponentProps<"div"> {
	/** The step this content belongs to. */
	readonly value: number;
	/** Keep the content mounted (hidden) while its step is not active. */
	readonly forceMount?: boolean | undefined;
}

const StepperContent = React.forwardRef<HTMLDivElement, StepperContentProps>(function StepperContent(
	{ value, forceMount = false, className, ...props },
	ref,
): React.JSX.Element | null {
	const { activeStep, baseId } = useStepper();
	const isActive = value === activeStep;

	if (!forceMount && !isActive) {
		return null;
	}

	return (
		<div
			ref={ref}
			role="tabpanel"
			id={panelId(baseId, value)}
			aria-labelledby={tabId(baseId, value)}
			data-slot="stepper-content"
			data-state={activeStep}
			hidden={!isActive}
			className={cn("w-full", className)}
			{...props}
		/>
	);
});

export {
	useStepper,
	useStepItem,
	Stepper,
	StepperItem,
	StepperTrigger,
	StepperIndicator,
	StepperSeparator,
	StepperTitle,
	StepperDescription,
	StepperPanel,
	StepperContent,
	StepperNav,
	stepperIndicatorVariants,
	type StepperProps,
	type StepperItemProps,
	type StepperTriggerProps,
	type StepperIndicatorProps,
	type StepperContentProps,
};
