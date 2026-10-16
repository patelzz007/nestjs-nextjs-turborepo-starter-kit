// Ported from shadcn/ui (base-vega `questionnaire`), styling the headless
// `@shadcn/react/questionnaire` primitive: a one-question-at-a-time form with
// keyboard shortcuts, skip / previous / next / submit and per-item
// validation. Part names, props and `data-slot` values match shadcn, so its
// docs and examples apply, with these deliberate deviations:
// - No built-in English: the primitive's default copy (progress text and its
//   accessible name, the two error messages, the four button labels) comes
//   from the `questionnaire` family of `UiKitLabelsProvider`, overridable per
//   usage by the root's `labels` prop or a part's own `children`.
// - `QuestionnaireProgress`'s `render` takes the function form only (it is
//   how the localized value text reaches a custom progress bar); the
//   element form is dropped.
// - Every part forwards its ref; the navigation buttons carry the Button
//   CVA `state` axis (disabled) alongside `size` / `variant`.
// - Icons are lucide's (`CheckIcon`); the heading uses the `font-heading` token.
"use client";

import { Questionnaire as QuestionnairePrimitive } from "@shadcn/react/questionnaire";
import { buttonVariants } from "@workspace/ui/components/button";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { resolveFieldState } from "@workspace/ui/lib/form/field-state";
import { cn } from "@workspace/ui/lib/core/utils";
import type { UiKitLabelsOverride } from "@workspace/ui/lib/labels/ui-kit-labels";
import { cva, type VariantProps } from "class-variance-authority";
import { CheckIcon } from "lucide-react";
import * as React from "react";

/** Copy for the questionnaire — the `questionnaire` family of `UiKitLabels`. */
export interface QuestionnaireLabels {
	/** Accessible name of the progress bar. */
	readonly progressLabel: string;
	/** Progress text and value text, e.g. "Question 2 of 5". */
	readonly progress: (current: number, total: number) => string;
	/** Error under a required question left unanswered. */
	readonly errorRequired: string;
	/** Error under an optional question left unanswered (it can be skipped instead). */
	readonly errorOptional: string;
	readonly previous: string;
	readonly skip: string;
	readonly next: string;
	readonly submit: string;
}

const QuestionnaireLabelsOverrideContext = React.createContext<UiKitLabelsOverride<"questionnaire"> | undefined>(undefined);

/** Whether the enclosing item is required — picks the error message. */
const QuestionnaireItemRequiredContext = React.createContext<boolean>(false);

function useQuestionnaireLabels(): QuestionnaireLabels {
	return useUiKitLabels("questionnaire", React.useContext(QuestionnaireLabelsOverrideContext));
}

type ButtonVariantProps = Pick<VariantProps<typeof buttonVariants>, "size" | "variant">;

interface QuestionnaireProps extends React.ComponentPropsWithoutRef<typeof QuestionnairePrimitive.Root> {
	/** Per-usage copy overrides for every part below. Keep it a module constant. */
	readonly labels?: UiKitLabelsOverride<"questionnaire"> | undefined;
}

/** The `<form>`: owns the active item (`item` / `defaultItem` / `onItemChange`) and the `items` collection. */
const Questionnaire = React.forwardRef<HTMLFormElement, QuestionnaireProps>(function Questionnaire({ className, labels, ...props }, ref): React.JSX.Element {
	return (
		<QuestionnaireLabelsOverrideContext.Provider value={labels}>
			<QuestionnairePrimitive.Root ref={ref} data-slot="questionnaire" className={cn("flex w-full min-w-0 flex-col gap-6", className)} {...props} />
		</QuestionnaireLabelsOverrideContext.Provider>
	);
});

type ProgressPrimitiveProps = React.ComponentPropsWithoutRef<typeof QuestionnairePrimitive.Progress>;

/** Receives the primitive's props (with the localized value text) and the progress state. */
type QuestionnaireProgressRender = Exclude<NonNullable<ProgressPrimitiveProps["render"]>, React.ReactElement>;

interface QuestionnaireProgressProps extends Omit<ProgressPrimitiveProps, "render"> {
	/** Custom progress UI; spread the received props onto its root to keep the progressbar semantics. */
	readonly render?: QuestionnaireProgressRender | undefined;
}

/** `role="progressbar"`, announced politely; shows "Question N of M" unless given `children` or `render`. */
const QuestionnaireProgress = React.forwardRef<HTMLDivElement, QuestionnaireProgressProps>(function QuestionnaireProgress(
	{ className, children, render, "aria-label": ariaLabel, "aria-valuetext": ariaValueText, ...props },
	ref,
): React.JSX.Element {
	const labels = useQuestionnaireLabels();
	const renderProgress = React.useCallback<QuestionnaireProgressRender>(
		(renderProps, state): React.ReactElement | null => {
			const valueText = state.total > 0 ? labels.progress(state.current, state.total) : undefined;
			const localized = { ...renderProps, "aria-valuetext": ariaValueText ?? valueText, children: children ?? valueText };
			return render === undefined ? <div {...localized} /> : render(localized, state);
		},
		[ariaValueText, children, labels, render],
	);

	return (
		<QuestionnairePrimitive.Progress
			ref={ref}
			data-slot="questionnaire-progress"
			aria-label={ariaLabel ?? labels.progressLabel}
			className={cn("min-h-[1lh] w-fit min-w-[14ch] text-xs font-medium text-muted-foreground tabular-nums", className)}
			render={renderProgress}
			{...props}
		/>
	);
});

/** One question — a `<fieldset>`, shown only while active. */
const QuestionnaireItem = React.forwardRef<HTMLFieldSetElement, React.ComponentPropsWithoutRef<typeof QuestionnairePrimitive.Item>>(function QuestionnaireItem(
	{ className, required = false, ...props },
	ref,
): React.JSX.Element {
	return (
		<QuestionnaireItemRequiredContext.Provider value={required}>
			<QuestionnairePrimitive.Item
				ref={ref}
				data-slot="questionnaire-item"
				required={required}
				className={cn("flex min-w-0 flex-col gap-5 border-0 p-0 outline-none", className)}
				{...props}
			/>
		</QuestionnaireItemRequiredContext.Provider>
	);
});

/** The question — the fieldset's `<legend>`. */
const QuestionnaireTitle = React.forwardRef<HTMLLegendElement, React.ComponentPropsWithoutRef<typeof QuestionnairePrimitive.Title>>(function QuestionnaireTitle(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return (
		<QuestionnairePrimitive.Title
			ref={ref}
			data-slot="questionnaire-title"
			className={cn("font-heading text-base font-semibold text-pretty [&:not(:has(~[data-slot=questionnaire-description]))]:mb-5", className)}
			{...props}
		/>
	);
});

/** Help text, wired into the item's `aria-describedby`. */
const QuestionnaireDescription = React.forwardRef<HTMLParagraphElement, React.ComponentPropsWithoutRef<typeof QuestionnairePrimitive.Description>>(
	function QuestionnaireDescription({ className, ...props }, ref): React.JSX.Element {
		return (
			<QuestionnairePrimitive.Description ref={ref} data-slot="questionnaire-description" className={cn("text-sm text-pretty text-muted-foreground", className)} {...props} />
		);
	},
);

/** The answer list: radios, or checkboxes when the item is `multiple`. */
const QuestionnaireChoices = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof QuestionnairePrimitive.Choices>>(function QuestionnaireChoices(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return <QuestionnairePrimitive.Choices ref={ref} data-slot="questionnaire-choices" className={cn("group/questionnaire-choices grid min-w-0 gap-3", className)} {...props} />;
});

/** One answer: a full-card `<label>` around a native radio / checkbox, an indicator and its shortcut key. */
type QuestionnaireChoiceProps = React.ComponentPropsWithoutRef<typeof QuestionnairePrimitive.Choice>;

const QuestionnaireChoice: React.ForwardRefExoticComponent<QuestionnaireChoiceProps & React.RefAttributes<HTMLLabelElement>> = React.forwardRef<
	HTMLLabelElement,
	QuestionnaireChoiceProps
>(function QuestionnaireChoice({ children, className, ...props }, ref): React.JSX.Element {
	return (
		<QuestionnairePrimitive.Choice
			ref={ref}
			data-slot="questionnaire-choice"
			className={cn(
				"group/questionnaire-choice relative flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-input bg-transparent px-4 py-3.5 text-start text-sm shadow-xs transition-colors outline-none select-none hover:bg-muted/50 has-[>input:focus-visible]:border-ring has-[>input:focus-visible]:ring-3 has-[>input:focus-visible]:ring-ring/50 data-invalid:border-destructive dark:bg-input/20 data-checked:border-primary/40 data-checked:bg-muted dark:data-checked:bg-muted",
				"data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-50",
				className,
			)}
			{...props}>
			<QuestionnairePrimitive.ChoiceInput data-slot="questionnaire-choice-input" className="absolute inset-0 z-10 size-full cursor-pointer opacity-0" />
			<span
				aria-hidden="true"
				data-slot="questionnaire-choice-indicator"
				className="pointer-events-none relative flex size-4 shrink-0 translate-y-[--spacing(0.45)] items-center justify-center rounded-[4px] border border-input group-has-data-[slot=questionnaire-choice-description]/questionnaire-choice:translate-y-0.5 group-data-[type=radio]/questionnaire-choice:rounded-full group-data-checked/questionnaire-choice:border-primary group-data-checked/questionnaire-choice:bg-primary group-data-checked/questionnaire-choice:text-primary-foreground dark:bg-input/30 dark:group-data-checked/questionnaire-choice:bg-primary">
				<span
					data-slot="questionnaire-choice-indicator-dot"
					className="hidden size-2 rounded-full bg-primary-foreground group-data-[type=checkbox]/questionnaire-choice:hidden group-data-checked/questionnaire-choice:block"
				/>
				<CheckIcon
					data-slot="questionnaire-choice-indicator-check"
					className="hidden size-3.5 group-data-[type=radio]/questionnaire-choice:hidden group-data-checked/questionnaire-choice:block"
				/>
			</span>
			<QuestionnairePrimitive.ChoiceLabel data-slot="questionnaire-choice-label" className="flex min-w-0 flex-1 flex-col gap-1 leading-snug">
				{children}
			</QuestionnairePrimitive.ChoiceLabel>
			<QuestionnairePrimitive.ChoiceShortcut
				data-slot="questionnaire-choice-shortcut"
				className="pointer-events-none ms-auto hidden size-5 shrink-0 translate-y-[--spacing(0.45)] items-center justify-center rounded-md border border-input bg-background font-mono text-[0.625rem] leading-none font-medium text-muted-foreground shadow-xs group-has-data-[slot=questionnaire-choice-description]/questionnaire-choice:translate-y-0.5 group-data-[shortcut]/questionnaire-choice:inline-flex"
			/>
		</QuestionnairePrimitive.Choice>
	);
});

/** A second, muted line inside a choice. */
const QuestionnaireChoiceDescription = React.forwardRef<HTMLSpanElement, React.ComponentProps<"span">>(function QuestionnaireChoiceDescription(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return <span ref={ref} data-slot="questionnaire-choice-description" className={cn("text-muted-foreground", className)} {...props} />;
});

const questionnaireInputVariants = cva(
	[
		"h-9 min-h-11 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-base shadow-xs transition-[color,box-shadow,background-color] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 sm:min-h-0 md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
		"selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground",
	],
	{
		variants: {
			state: {
				default: "",
				loading: "pointer-events-none opacity-60",
				disabled: "pointer-events-none cursor-not-allowed opacity-50",
				error: "border-destructive ring-3 ring-destructive/20 dark:border-destructive/50 dark:ring-destructive/40",
			},
		},
		defaultVariants: {
			state: "default",
		},
	},
);

/** A free-text answer; counts as answered once it holds non-blank text. Validity comes from the item. */
type QuestionnaireInputProps = React.ComponentPropsWithoutRef<typeof QuestionnairePrimitive.Input>;

const QuestionnaireInput: React.ForwardRefExoticComponent<QuestionnaireInputProps & React.RefAttributes<HTMLInputElement>> = React.forwardRef<
	HTMLInputElement,
	QuestionnaireInputProps
>(function QuestionnaireInput({ className, disabled, ...props }, ref): React.JSX.Element {
	const state = resolveFieldState({ disabled });

	return (
		<div data-slot="questionnaire-input-wrapper" className="group/questionnaire-input relative w-full min-w-0">
			<QuestionnairePrimitive.Input
				ref={ref}
				data-slot="questionnaire-input"
				disabled={disabled}
				className={cn(questionnaireInputVariants({ state }), className)}
				{...props}
			/>
		</div>
	);
});

/** The item's error (`role="alert"` while invalid); defaults to the required / optional message. */
const QuestionnaireError = React.forwardRef<HTMLParagraphElement, React.ComponentPropsWithoutRef<typeof QuestionnairePrimitive.Error>>(function QuestionnaireError(
	{ className, children, ...props },
	ref,
): React.JSX.Element {
	const labels = useQuestionnaireLabels();
	const required = React.useContext(QuestionnaireItemRequiredContext);

	return (
		<QuestionnairePrimitive.Error ref={ref} data-slot="questionnaire-error" className={cn("text-sm text-destructive", className)} {...props}>
			{children ?? (required ? labels.errorRequired : labels.errorOptional)}
		</QuestionnairePrimitive.Error>
	);
});

/** Lays out Previous (start) and Skip + Next / Submit (end) on one row. */
const QuestionnaireActions = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function QuestionnaireActions({ className, ...props }, ref): React.JSX.Element {
	return (
		<div
			ref={ref}
			data-slot="questionnaire-actions"
			className={cn("grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 sm:min-h-9", className)}
			{...props}
		/>
	);
});

type QuestionnairePreviousProps = React.ComponentPropsWithoutRef<typeof QuestionnairePrimitive.Previous> & ButtonVariantProps;

/** Back one item; hidden on the first. */
const QuestionnairePrevious = React.forwardRef<HTMLButtonElement, QuestionnairePreviousProps>(function QuestionnairePrevious(
	{ children, className, size = "default", variant = "outline", disabled, ...props },
	ref,
): React.JSX.Element {
	const labels = useQuestionnaireLabels();
	const state = resolveFieldState({ disabled });

	return (
		<QuestionnairePrimitive.Previous
			ref={ref}
			data-slot="questionnaire-previous"
			data-size={size}
			data-variant={variant}
			disabled={disabled}
			className={cn(buttonVariants({ size, variant, state }), "col-start-1 row-start-1 min-h-11 justify-self-start sm:min-h-0", className)}
			{...props}>
			{children ?? labels.previous}
		</QuestionnairePrimitive.Previous>
	);
});

type QuestionnaireSkipProps = React.ComponentPropsWithoutRef<typeof QuestionnairePrimitive.Skip> & ButtonVariantProps;

/** Skips an optional item (on the last one, submits); hidden on required items. */
const QuestionnaireSkip = React.forwardRef<HTMLButtonElement, QuestionnaireSkipProps>(function QuestionnaireSkip(
	{ children, className, size = "default", variant = "outline", disabled, ...props },
	ref,
): React.JSX.Element {
	const labels = useQuestionnaireLabels();
	const state = resolveFieldState({ disabled });

	return (
		<QuestionnairePrimitive.Skip
			ref={ref}
			data-slot="questionnaire-skip"
			data-size={size}
			data-variant={variant}
			disabled={disabled}
			className={cn(buttonVariants({ size, variant, state }), "col-start-2 row-start-1 min-h-11 justify-self-end sm:min-h-0", className)}
			{...props}>
			{children ?? labels.skip}
		</QuestionnairePrimitive.Skip>
	);
});

type QuestionnaireNextProps = React.ComponentPropsWithoutRef<typeof QuestionnairePrimitive.Next> & ButtonVariantProps;

/** Validates the item and moves on; hidden on the last. */
const QuestionnaireNext = React.forwardRef<HTMLButtonElement, QuestionnaireNextProps>(function QuestionnaireNext(
	{ children, className, size = "default", variant = "default", disabled, ...props },
	ref,
): React.JSX.Element {
	const labels = useQuestionnaireLabels();
	const state = resolveFieldState({ disabled });

	return (
		<QuestionnairePrimitive.Next
			ref={ref}
			data-slot="questionnaire-next"
			data-size={size}
			data-variant={variant}
			disabled={disabled}
			className={cn(buttonVariants({ size, variant, state }), "col-start-3 row-start-1 min-h-11 justify-self-end sm:min-h-0", className)}
			{...props}>
			{children ?? labels.next}
		</QuestionnairePrimitive.Next>
	);
});

type QuestionnaireSubmitProps = React.ComponentPropsWithoutRef<typeof QuestionnairePrimitive.Submit> & ButtonVariantProps;

/** Submits the form (every item validated first); shown only on the last item. */
const QuestionnaireSubmit = React.forwardRef<HTMLButtonElement, QuestionnaireSubmitProps>(function QuestionnaireSubmit(
	{ children, className, size = "default", variant = "default", disabled, ...props },
	ref,
): React.JSX.Element {
	const labels = useQuestionnaireLabels();
	const state = resolveFieldState({ disabled });

	return (
		<QuestionnairePrimitive.Submit
			ref={ref}
			data-slot="questionnaire-submit"
			data-size={size}
			data-variant={variant}
			disabled={disabled}
			className={cn(buttonVariants({ size, variant, state }), "col-start-3 row-start-1 min-h-11 justify-self-end sm:min-h-0", className)}
			{...props}>
			{children ?? labels.submit}
		</QuestionnairePrimitive.Submit>
	);
});

export type {
	QuestionnaireChoiceDefinition,
	QuestionnaireInputType,
	QuestionnaireItemDefinition,
	QuestionnaireItemStatus,
	QuestionnaireShortcutMode,
} from "@shadcn/react/questionnaire";

export {
	Questionnaire,
	QuestionnaireActions,
	QuestionnaireChoice,
	QuestionnaireChoiceDescription,
	QuestionnaireChoices,
	QuestionnaireDescription,
	QuestionnaireError,
	QuestionnaireInput,
	QuestionnaireItem,
	QuestionnaireNext,
	QuestionnairePrevious,
	QuestionnaireProgress,
	QuestionnaireSkip,
	QuestionnaireSubmit,
	QuestionnaireTitle,
	questionnaireInputVariants,
	type QuestionnaireProps,
	type QuestionnaireProgressProps,
	type QuestionnaireProgressRender,
	type QuestionnaireChoiceProps,
	type QuestionnaireInputProps,
	type QuestionnairePreviousProps,
	type QuestionnaireSkipProps,
	type QuestionnaireNextProps,
	type QuestionnaireSubmitProps,
};
