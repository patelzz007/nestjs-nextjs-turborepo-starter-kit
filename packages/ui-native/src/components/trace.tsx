// A compact activity log (the web kit's `Trace`): one line per step — an
// agent's tool calls, a pipeline's jobs, an import's stages — each optionally
// opening to its detail.
//
// - Trace: the column of steps.
// - TraceLine: one step — a glyph (or anything, `leading`), a title and a
//   short description (a duration, a count). `status` says where it is:
//   `running` (the title breathes; still under Reduce Motion), `error`
//   (destructive), `pending` (dimmed); none means done. Say the status in the
//   title too: the glyph is decorative and the colour is not read out. With
//   `onPress` the line is a button (or a link, `accessibilityRole`).
// - TraceStep: a line that opens to its detail, indented under a rule, with
//   a chevron that turns. Uncontrolled (`defaultOpen`), or controlled (`open`
//   with `onOpenChange`). Built on the kit's Collapsible.
//
// Presentational and data-agnostic: the caller passes the steps. The ref
// reaches each part's root view.

import { cva, type VariantProps } from "class-variance-authority";
import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import * as React from "react";
import { Pressable, Text, View, type ViewInstance } from "react-native";
import Animated from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { cn } from "../lib/cn";
import { usePulseStyle } from "../lib/use-pulse-style";
import { Collapsible, CollapsibleContent } from "./collapsible";
import { Icon, type LucideIcon } from "./icon";

/** Reanimated's view with Uniwind's `className` (static classes, animated `style`). */
const StyledAnimatedView = withUniwind(Animated.View);

export const traceVariants = cva("w-full gap-2");

export const traceLineVariants = cva("max-w-full flex-row items-center gap-2 self-start", {
	variants: {
		status: { done: "", running: "", error: "", pending: "opacity-60" },
		pressable: { true: "min-h-11 active:opacity-70", false: "" },
	},
	defaultVariants: { status: "done", pressable: false },
});

export const traceTitleVariants = cva("text-label shrink font-sans", {
	variants: {
		status: { done: "text-muted-foreground", running: "text-foreground", error: "text-destructive-foreground", pending: "text-muted-foreground" },
	},
	defaultVariants: { status: "done" },
});

export const traceIconVariants = cva("", {
	variants: {
		status: { done: "accent-muted-foreground", running: "accent-foreground", error: "accent-destructive-foreground", pending: "accent-muted-foreground" },
	},
	defaultVariants: { status: "done" },
});

/** A step's chevron: pointing at its title, turned down while open. */
export const traceChevronVariants = cva("", {
	variants: { open: { true: "rotate-90", false: "" } },
	defaultVariants: { open: false },
});

/** The detail under an open step: indented under a rule that lines up with the glyph. */
export const traceDetailVariants = cva("mt-2 mb-1 ml-2 min-w-0 gap-2 border-l border-border pl-4");

export type TraceLineStatus = NonNullable<VariantProps<typeof traceLineVariants>["status"]>;

/** The touch area added around a short pressable line, to reach 44 pt (rules/04). */
const LINE_HIT_SLOP = 4;

export interface TraceProps {
	readonly children: React.ReactNode;
	/** The log's name for screen readers ("Agent steps"). */
	readonly accessibilityLabel?: string | undefined;
	/** Extra classes for the column, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const Trace = React.memo(
	React.forwardRef<ViewInstance, TraceProps>(function Trace({ children, accessibilityLabel, className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} accessibilityLabel={accessibilityLabel} testID={testID} className={cn(traceVariants(), className)}>
				{children}
			</View>
		);
	}),
);

/** What a step shows: its glyph, title, description and status. */
export interface TraceLineContent {
	/** What happened, in words (it is all a screen reader gets of the step): "Ran pnpm test". */
	readonly title: string;
	/** A short detail after the title: a duration, a count ("12 passed"). */
	readonly description?: string | undefined;
	/** A decorative glyph before the title. */
	readonly icon?: LucideIcon | undefined;
	/** Anything before the title in place of a glyph (an avatar, a spinner). Decorative. */
	readonly leading?: React.ReactNode | undefined;
	/** A decorative glyph after the description (a chevron on a link). */
	readonly trailingIcon?: LucideIcon | undefined;
	/** Anything after the description (a badge with the step's share of the time). */
	readonly trailing?: React.ReactNode | undefined;
	/** No status: done. */
	readonly status?: TraceLineStatus | undefined;
}

export interface TraceLineProps extends TraceLineContent {
	/** Makes the line a button (or a link). */
	readonly onPress?: (() => void) | undefined;
	readonly accessibilityRole?: "button" | "link" | undefined;
	/** The line's name for screen readers. Default: the title and the description. */
	readonly accessibilityLabel?: string | undefined;
	/** Extra classes for the line, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** The title, breathing while its step runs. */
function TraceTitle({ title, status }: { readonly title: string; readonly status: TraceLineStatus }): React.JSX.Element {
	const pulseStyle = usePulseStyle();
	const text = (
		<Text numberOfLines={1} className={traceTitleVariants({ status })}>
			{title}
		</Text>
	);
	return status === "running" ? (
		<StyledAnimatedView style={pulseStyle} className="shrink">
			{text}
		</StyledAnimatedView>
	) : (
		text
	);
}

/** The step's glyph, title and description, in a row. */
function TraceLineBody({ title, description, icon, leading, trailingIcon, trailing, status = "done" }: TraceLineContent): React.JSX.Element {
	return (
		<>
			{leading ?? null}
			{icon === undefined ? null : <Icon icon={icon} size="sm" colorClassName={traceIconVariants({ status })} />}
			<TraceTitle title={title} status={status} />
			{description === undefined ? null : <Text className="text-label font-sans text-muted-foreground/70 tabular-nums">{description}</Text>}
			{trailingIcon === undefined ? null : <Icon icon={trailingIcon} size="sm" colorClassName={traceIconVariants({ status })} />}
			{trailing ?? null}
		</>
	);
}

/** The line's spoken name: the title, then the description. */
export function traceLineLabelOf(title: string, description: string | undefined): string {
	return description === undefined ? title : `${title}, ${description}`;
}

export const TraceLine = React.memo(
	React.forwardRef<ViewInstance, TraceLineProps>(function TraceLine(
		{ title, description, icon, leading, trailingIcon, trailing, status = "done", onPress, accessibilityRole = "button", accessibilityLabel, className, testID },
		ref,
	): React.JSX.Element {
		const label = accessibilityLabel ?? traceLineLabelOf(title, description);
		const body = <TraceLineBody title={title} description={description} icon={icon} leading={leading} trailingIcon={trailingIcon} trailing={trailing} status={status} />;
		if (onPress !== undefined) {
			return (
				<Pressable
					ref={ref}
					accessibilityRole={accessibilityRole}
					accessibilityLabel={label}
					onPress={onPress}
					hitSlop={LINE_HIT_SLOP}
					testID={testID}
					className={cn(traceLineVariants({ status, pressable: true }), className)}>
					{body}
				</Pressable>
			);
		}
		return (
			<View ref={ref} accessible accessibilityLabel={label} testID={testID} className={cn(traceLineVariants({ status }), className)}>
				{body}
			</View>
		);
	}),
);

/** Uncontrolled (`defaultOpen`), or controlled: then `open` and `onOpenChange` come together. */
export type TraceStepOpenState =
	| {
			/** Uncontrolled: whether it starts open. */
			readonly defaultOpen?: boolean | undefined;
			readonly open?: undefined;
			readonly onOpenChange?: undefined;
	  }
	| {
			readonly defaultOpen?: undefined;
			/** Whether the detail is shown, controlled. */
			readonly open: boolean;
			readonly onOpenChange: (open: boolean) => void;
	  };

export type TraceStepProps = TraceLineContent &
	TraceStepOpenState & {
		/** The step's detail (output, a diff, a list of rows). */
		readonly children: React.ReactNode;
		/** The line's name for screen readers. Default: the title and the description. */
		readonly accessibilityLabel?: string | undefined;
		/** Extra classes for the indented detail, merged last. */
		readonly detailClassName?: string | undefined;
		/** Extra classes for the step, merged last. */
		readonly className?: string | undefined;
		readonly testID?: string | undefined;
	};

export const TraceStep = React.memo(
	React.forwardRef<ViewInstance, TraceStepProps>(function TraceStep(
		{
			title,
			description,
			icon,
			leading,
			trailingIcon,
			trailing,
			status = "done",
			defaultOpen = false,
			open,
			onOpenChange,
			children,
			accessibilityLabel,
			detailClassName,
			className,
			testID,
		},
		ref,
	): React.JSX.Element {
		const [ownOpen, setOwnOpen] = React.useState(defaultOpen);
		const isOpen = open ?? ownOpen;
		const setOpen = React.useCallback(
			(next: boolean): void => {
				if (onOpenChange === undefined) {
					setOwnOpen(next);
				} else {
					onOpenChange(next);
				}
			},
			[onOpenChange],
		);
		const toggle = React.useCallback((): void => {
			setOpen(!isOpen);
		}, [isOpen, setOpen]);
		const accessibilityState = React.useMemo(() => ({ expanded: isOpen }), [isOpen]);
		return (
			<Collapsible ref={ref} open={isOpen} onOpenChange={setOpen} testID={testID} className={cn("w-full min-w-0", className)}>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={accessibilityLabel ?? traceLineLabelOf(title, description)}
					accessibilityState={accessibilityState}
					onPress={toggle}
					hitSlop={LINE_HIT_SLOP}
					testID={testID === undefined ? undefined : `${testID}-trigger`}
					className={traceLineVariants({ status, pressable: true })}>
					<TraceLineBody title={title} description={description} icon={icon} leading={leading} trailingIcon={trailingIcon} trailing={trailing} status={status} />
					<View className={traceChevronVariants({ open: isOpen })}>
						<Icon icon={ChevronRightIcon} size="sm" colorClassName={traceIconVariants({ status })} />
					</View>
				</Pressable>
				<CollapsibleContent className={cn(traceDetailVariants(), detailClassName)} testID={testID === undefined ? undefined : `${testID}-detail`}>
					{children}
				</CollapsibleContent>
			</Collapsible>
		);
	}),
);
