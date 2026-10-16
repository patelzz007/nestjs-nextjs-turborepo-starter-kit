// A section that shows or hides its content behind a trigger ("Show
// details"): the phone form of the web kit's Collapsible, with the same parts —
// Collapsible, CollapsibleTrigger, CollapsibleContent.
//
// Controlled: the caller owns `open` and hears `onOpenChange(open)` when the
// trigger is pressed. The trigger announces `expanded`; its chevron turns with
// it. The content fades in as it appears (Reanimated, on the UI thread) and
// simply appears under Reduce Motion or with `animated={false}`.
// The Accordion (./accordion.tsx) is built from these parts.

import { cva, type VariantProps } from "class-variance-authority";
import ChevronDownIcon from "lucide-react-native/icons/chevron-down";
import ChevronUpIcon from "lucide-react-native/icons/chevron-up";
import * as React from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, ReduceMotion } from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { cn } from "../lib/cn";
import { resolveControlState } from "../lib/control-state";
import { CONTROL_SWAP_MS } from "../lib/motion";
import { useReduceMotion } from "../lib/use-reduce-motion";
import { Icon, type LucideIcon } from "./icon";

const StyledAnimatedView = withUniwind(Animated.View);

/** The content's arrival and departure: the short header-control fade, following Reduce Motion. */
const CONTENT_ENTERING = FadeIn.duration(CONTROL_SWAP_MS).reduceMotion(ReduceMotion.System);
const CONTENT_EXITING = FadeOut.duration(CONTROL_SWAP_MS).reduceMotion(ReduceMotion.System);

export const collapsibleVariants = cva("", {
	variants: {
		/** `card`: the section sits in a bordered card; `plain`: it adds no surface of its own. */
		variant: { plain: "", card: "rounded-lg border border-border bg-card" },
		size: { md: "", sm: "" },
		state: { default: "", loading: "", disabled: "opacity-60", error: "border-destructive" },
	},
	defaultVariants: { variant: "plain", size: "md", state: "default" },
});

export const collapsibleTriggerVariants = cva("flex-row items-center gap-3 active:opacity-70", {
	variants: {
		variant: { plain: "", card: "px-4" },
		size: { md: "min-h-11 py-3", sm: "min-h-11 py-2" },
		state: { default: "", loading: "", disabled: "", error: "" },
	},
	defaultVariants: { variant: "plain", size: "md", state: "default" },
});

export const collapsibleTriggerLabelVariants = cva("font-sans-medium flex-1 text-foreground", {
	variants: {
		size: { md: "text-base", sm: "text-sm" },
	},
	defaultVariants: { size: "md" },
});

export const collapsibleContentVariants = cva("", {
	variants: {
		variant: { plain: "pb-3", card: "px-4 pb-4" },
	},
	defaultVariants: { variant: "plain" },
});

type CollapsibleVariantProps = VariantProps<typeof collapsibleVariants>;
export type CollapsibleVariant = NonNullable<CollapsibleVariantProps["variant"]>;
export type CollapsibleSize = NonNullable<CollapsibleVariantProps["size"]>;

interface CollapsibleContextValue {
	readonly open: boolean;
	readonly toggle: () => void;
	readonly disabled: boolean;
	readonly animated: boolean;
	readonly variant: CollapsibleVariant;
	readonly size: CollapsibleSize;
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(null);

function useCollapsibleContext(part: string): CollapsibleContextValue {
	const context = React.useContext(CollapsibleContext);
	if (context === null) {
		throw new Error(`${part} must be rendered inside a Collapsible.`);
	}
	return context;
}

export interface CollapsibleProps {
	readonly open: boolean;
	/** The trigger asked to open (`true`) or close (`false`). */
	readonly onOpenChange: (open: boolean) => void;
	/** The trigger and the content (CollapsibleTrigger, CollapsibleContent). */
	readonly children: React.ReactNode;
	readonly variant?: CollapsibleVariant;
	readonly size?: CollapsibleSize;
	readonly disabled?: boolean;
	readonly invalid?: boolean;
	/** Fades the content in and out (default `true`; never under Reduce Motion). */
	readonly animated?: boolean;
	/** Extra classes for the container, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const Collapsible = React.memo(
	React.forwardRef<View, CollapsibleProps>(function Collapsible(
		{ open, onOpenChange, children, variant = "plain", size = "md", disabled = false, invalid = false, animated = true, className, testID },
		ref,
	): React.JSX.Element {
		const reduceMotion = useReduceMotion();
		const toggle = React.useCallback((): void => {
			onOpenChange(!open);
		}, [onOpenChange, open]);
		const context = React.useMemo(
			(): CollapsibleContextValue => ({ open, toggle, disabled, animated: animated && !reduceMotion, variant, size }),
			[animated, disabled, open, reduceMotion, size, toggle, variant],
		);
		const state = resolveControlState({ disabled, invalid });
		return (
			<CollapsibleContext.Provider value={context}>
				<View ref={ref} testID={testID} className={cn(collapsibleVariants({ variant, size, state }), className)}>
					{children}
				</View>
			</CollapsibleContext.Provider>
		);
	}),
);

export interface CollapsibleTriggerProps {
	/** The trigger's text and accessible name ("Show details"). */
	readonly label: string;
	/** A glyph before the label; decorative. */
	readonly icon?: LucideIcon | undefined;
	/** What opening reveals, for screen readers. */
	readonly accessibilityHint?: string | undefined;
	/** Extra classes for the trigger, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const CollapsibleTrigger = React.memo(
	React.forwardRef<View, CollapsibleTriggerProps>(function CollapsibleTrigger({ label, icon, accessibilityHint, className, testID }, ref): React.JSX.Element {
		const { open, toggle, disabled, variant, size } = useCollapsibleContext("CollapsibleTrigger");
		const accessibilityState = React.useMemo(() => ({ expanded: open, disabled }), [disabled, open]);
		return (
			<Pressable
				ref={ref}
				accessibilityRole="button"
				accessibilityLabel={label}
				accessibilityHint={accessibilityHint}
				accessibilityState={accessibilityState}
				disabled={disabled}
				onPress={toggle}
				testID={testID}
				className={cn(collapsibleTriggerVariants({ variant, size }), className)}>
				{icon === undefined ? null : <Icon icon={icon} size="md" colorClassName="accent-muted-foreground" />}
				<Text className={collapsibleTriggerLabelVariants({ size })}>{label}</Text>
				<Icon icon={open ? ChevronUpIcon : ChevronDownIcon} size="md" colorClassName="accent-muted-foreground" />
			</Pressable>
		);
	}),
);

export interface CollapsibleContentProps {
	readonly children: React.ReactNode;
	/** Extra classes for the content, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** Rendered only while open: closed content is not laid out, read or focused. */
export const CollapsibleContent = React.memo(
	React.forwardRef<View, CollapsibleContentProps>(function CollapsibleContent({ children, className, testID }, ref): React.JSX.Element | null {
		const { open, animated, variant } = useCollapsibleContext("CollapsibleContent");
		if (!open) {
			return null;
		}
		const classes = cn(collapsibleContentVariants({ variant }), className);
		return animated ? (
			<StyledAnimatedView ref={ref} entering={CONTENT_ENTERING} exiting={CONTENT_EXITING} testID={testID} className={classes}>
				{children}
			</StyledAnimatedView>
		) : (
			<View ref={ref} testID={testID} className={classes}>
				{children}
			</View>
		);
	}),
);
