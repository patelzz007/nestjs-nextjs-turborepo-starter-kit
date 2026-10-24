// A stack of sections that open and close (an FAQ, grouped settings): the
// phone form of the web kit's Accordion, with the same parts — Accordion,
// AccordionItem, AccordionTrigger, AccordionContent. Each item is a
// Collapsible (./collapsible.tsx), so the trigger announces `expanded` and
// the content fades in, still under Reduce Motion.
//
// Controlled: the caller owns `value` — the ids of the open items — and hears
// `onChange(value)` when a trigger is pressed. `type="single"` keeps at most
// one item open (`collapsible` lets its trigger close it again);
// `type="multiple"` opens and closes each item on its own.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { resolveControlState } from "../lib/control-state";
import { Collapsible, CollapsibleContent, CollapsibleTrigger, type CollapsibleContentProps, type CollapsibleTriggerProps, type CollapsibleVariant } from "./collapsible";

export const accordionVariants = cva("", {
	variants: {
		/** `default`: items divided by a rule; `separated`: each item its own card. */
		variant: { default: "", separated: "gap-2" },
		size: { md: "", sm: "" },
		state: { default: "", loading: "", disabled: "opacity-60", error: "" },
	},
	defaultVariants: { variant: "default", size: "md", state: "default" },
});

export const accordionItemVariants = cva("", {
	variants: {
		variant: { default: "border-b border-border", separated: "" },
	},
	defaultVariants: { variant: "default" },
});

type AccordionVariantProps = VariantProps<typeof accordionVariants>;
export type AccordionVariant = NonNullable<AccordionVariantProps["variant"]>;
export type AccordionSize = NonNullable<AccordionVariantProps["size"]>;
export type AccordionType = "single" | "multiple";

/** The Collapsible look each accordion variant draws its items with. */
const ITEM_LOOK: Readonly<Record<AccordionVariant, CollapsibleVariant>> = {
	default: "plain",
	separated: "card",
};

/**
 * The open items after `item`'s trigger is pressed. `single`: it opens alone,
 * or closes when `collapsible`; `multiple`: it toggles, the others untouched.
 */
export function nextAccordionValue(value: readonly string[], item: string, type: AccordionType, collapsible: boolean): readonly string[] {
	const isOpen = value.includes(item);
	if (type === "multiple") {
		return isOpen ? value.filter((open: string): boolean => open !== item) : [...value, item];
	}
	if (isOpen) {
		return collapsible ? [] : value;
	}
	return [item];
}

interface AccordionContextValue {
	readonly value: readonly string[];
	readonly toggle: (item: string) => void;
	readonly disabled: boolean;
	readonly animated: boolean;
	readonly variant: AccordionVariant;
	readonly size: AccordionSize;
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null);

function useAccordionContext(): AccordionContextValue {
	const context = React.useContext(AccordionContext);
	if (context === null) {
		throw new Error("AccordionItem must be rendered inside an Accordion.");
	}
	return context;
}

export interface AccordionProps {
	/** The ids of the open items. */
	readonly value: readonly string[];
	readonly onChange: (value: readonly string[]) => void;
	/** The items (AccordionItem). */
	readonly children: React.ReactNode;
	/** `single` (default): one item open at a time. `multiple`: any number. */
	readonly type?: AccordionType;
	/** With `type="single"`, the open item's trigger closes it (default `true`). */
	readonly collapsible?: boolean;
	readonly variant?: AccordionVariant;
	readonly size?: AccordionSize;
	readonly disabled?: boolean;
	/** Fades content in and out (default `true`; never under Reduce Motion). */
	readonly animated?: boolean;
	/** Extra classes for the container, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const Accordion = React.memo(
	React.forwardRef<ViewInstance, AccordionProps>(function Accordion(
		{ value, onChange, children, type = "single", collapsible = true, variant = "default", size = "md", disabled = false, animated = true, className, testID },
		ref,
	): React.JSX.Element {
		const toggle = React.useCallback(
			(item: string): void => {
				onChange(nextAccordionValue(value, item, type, collapsible));
			},
			[collapsible, onChange, type, value],
		);
		const context = React.useMemo((): AccordionContextValue => ({ value, toggle, disabled, animated, variant, size }), [animated, disabled, size, toggle, value, variant]);
		const state = resolveControlState({ disabled });
		return (
			<AccordionContext.Provider value={context}>
				<View ref={ref} testID={testID} className={cn(accordionVariants({ variant, size, state }), className)}>
					{children}
				</View>
			</AccordionContext.Provider>
		);
	}),
);

export interface AccordionItemProps {
	/** The item's id, as it appears in the accordion's `value`. */
	readonly value: string;
	/** Its trigger and content (AccordionTrigger, AccordionContent). */
	readonly children: React.ReactNode;
	readonly disabled?: boolean;
	/** Extra classes for the item, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const AccordionItem = React.memo(
	React.forwardRef<ViewInstance, AccordionItemProps>(function AccordionItem({ value: item, children, disabled = false, className, testID }, ref): React.JSX.Element {
		const { value, toggle, disabled: groupDisabled, animated, variant, size } = useAccordionContext();
		const changeOpen = React.useCallback((): void => {
			toggle(item);
		}, [item, toggle]);
		return (
			<Collapsible
				ref={ref}
				open={value.includes(item)}
				onOpenChange={changeOpen}
				variant={ITEM_LOOK[variant]}
				size={size}
				disabled={disabled || groupDisabled}
				animated={animated}
				testID={testID}
				className={cn(accordionItemVariants({ variant }), className)}>
				{children}
			</Collapsible>
		);
	}),
);

export type AccordionTriggerProps = CollapsibleTriggerProps;

/** The item's heading: presses open or close it. */
export const AccordionTrigger = React.memo(
	React.forwardRef<ViewInstance, AccordionTriggerProps>(function AccordionTrigger(props, ref): React.JSX.Element {
		return <CollapsibleTrigger ref={ref} {...props} />;
	}),
);

export type AccordionContentProps = CollapsibleContentProps;

/** The item's body, rendered only while it is open. */
export const AccordionContent = React.memo(
	React.forwardRef<ViewInstance, AccordionContentProps>(function AccordionContent(props, ref): React.JSX.Element {
		return <CollapsibleContent ref={ref} {...props} />;
	}),
);
