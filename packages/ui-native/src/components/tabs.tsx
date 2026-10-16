// Views of one subject, one at a time ("Overview", "Activity", "Settings"):
// the phone form of the web kit's Tabs, with the same parts — Tabs, TabsList,
// TabsTrigger, TabsContent — and the same list looks (`default`: a muted
// track with the chosen tab raised on it; `line`: an underline).
//
// Controlled: the caller owns `value` (the chosen tab's id) and hears
// `onChange(value)` when another tab is pressed. The list is a `tablist`, each
// trigger a `tab` that announces `selected`; only the chosen tab's content is
// rendered.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Pressable, Text, View } from "react-native";

import { cn } from "../lib/cn";
import { resolveControlState } from "../lib/control-state";
import { Icon, type LucideIcon } from "./icon";

export const tabsListVariants = cva("flex-row items-center", {
	variants: {
		variant: {
			default: "gap-1 rounded-lg bg-muted p-1",
			line: "gap-1 border-b border-border",
		},
		size: { md: "", sm: "" },
		state: { default: "", loading: "", disabled: "opacity-60", error: "" },
	},
	defaultVariants: { variant: "default", size: "md", state: "default" },
});

export const tabsTriggerVariants = cva("flex-1 flex-row items-center justify-center gap-2 active:opacity-80", {
	variants: {
		variant: {
			default: "rounded-md",
			line: "border-b-2 border-transparent",
		},
		/** Both sizes keep the 44 pt touch target (rules/04); `sm` is tighter around its label. */
		size: { md: "min-h-11 px-3 py-2", sm: "min-h-11 px-2 py-1.5" },
		selected: { true: "", false: "" },
		state: { default: "", loading: "opacity-60", disabled: "opacity-60", error: "" },
	},
	compoundVariants: [
		{ variant: "default", selected: true, className: "bg-card shadow-sm" },
		{ variant: "line", selected: true, className: "border-primary" },
	],
	defaultVariants: { variant: "default", size: "md", selected: false, state: "default" },
});

export const tabsTriggerLabelVariants = cva("", {
	variants: {
		size: { md: "text-sm", sm: "text-xs" },
		selected: { true: "font-sans-semibold text-foreground", false: "font-sans-medium text-muted-foreground" },
	},
	defaultVariants: { size: "md", selected: false },
});

type TabsVariantProps = VariantProps<typeof tabsListVariants>;
export type TabsVariant = NonNullable<TabsVariantProps["variant"]>;
export type TabsSize = NonNullable<TabsVariantProps["size"]>;

interface TabsContextValue {
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly disabled: boolean;
	readonly variant: TabsVariant;
	readonly size: TabsSize;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext(part: string): TabsContextValue {
	const context = React.useContext(TabsContext);
	if (context === null) {
		throw new Error(`${part} must be rendered inside Tabs.`);
	}
	return context;
}

export interface TabsProps {
	/** The chosen tab's id. */
	readonly value: string;
	readonly onChange: (value: string) => void;
	/** The list and the panels (TabsList, TabsContent). */
	readonly children: React.ReactNode;
	readonly variant?: TabsVariant;
	readonly size?: TabsSize;
	readonly disabled?: boolean;
	/** Extra classes for the container, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const Tabs = React.memo(
	React.forwardRef<View, TabsProps>(function Tabs(
		{ value, onChange, children, variant = "default", size = "md", disabled = false, className, testID },
		ref,
	): React.JSX.Element {
		const context = React.useMemo((): TabsContextValue => ({ value, onChange, disabled, variant, size }), [disabled, onChange, size, value, variant]);
		return (
			<TabsContext.Provider value={context}>
				<View ref={ref} testID={testID} className={cn("gap-3", className)}>
					{children}
				</View>
			</TabsContext.Provider>
		);
	}),
);

export interface TabsListProps {
	/** The triggers (TabsTrigger). */
	readonly children: React.ReactNode;
	/** Names the set of tabs for screen readers ("Project sections"). */
	readonly accessibilityLabel?: string | undefined;
	/** Extra classes for the list, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const TabsList = React.memo(
	React.forwardRef<View, TabsListProps>(function TabsList({ children, accessibilityLabel, className, testID }, ref): React.JSX.Element {
		const { disabled, variant, size } = useTabsContext("TabsList");
		const state = resolveControlState({ disabled });
		return (
			<View
				ref={ref}
				accessibilityRole="tablist"
				accessibilityLabel={accessibilityLabel}
				testID={testID}
				className={cn(tabsListVariants({ variant, size, state }), className)}>
				{children}
			</View>
		);
	}),
);

export interface TabsTriggerProps {
	/** The tab's id, matched against the tabs' `value`. */
	readonly value: string;
	/** The tab's text and accessible name. */
	readonly label: string;
	/** A glyph before the label; decorative. */
	readonly icon?: LucideIcon | undefined;
	readonly disabled?: boolean;
	/** Extra classes for the trigger, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const TabsTrigger = React.memo(
	React.forwardRef<View, TabsTriggerProps>(function TabsTrigger({ value: tab, label, icon, disabled = false, className, testID }, ref): React.JSX.Element {
		const { value, onChange, disabled: groupDisabled, variant, size } = useTabsContext("TabsTrigger");
		const selected = value === tab;
		const isInactive = disabled || groupDisabled;
		const accessibilityState = React.useMemo(() => ({ selected, disabled: isInactive }), [isInactive, selected]);
		const choose = React.useCallback((): void => {
			if (!selected) {
				onChange(tab);
			}
		}, [onChange, selected, tab]);
		const state = resolveControlState({ disabled: isInactive });
		return (
			<Pressable
				ref={ref}
				accessibilityRole="tab"
				accessibilityLabel={label}
				accessibilityState={accessibilityState}
				disabled={isInactive}
				onPress={choose}
				testID={testID}
				className={cn(tabsTriggerVariants({ variant, size, selected, state }), className)}>
				{icon === undefined ? null : <Icon icon={icon} size="sm" colorClassName={selected ? "accent-foreground" : "accent-muted-foreground"} />}
				<Text numberOfLines={1} className={tabsTriggerLabelVariants({ size, selected })}>
					{label}
				</Text>
			</Pressable>
		);
	}),
);

export interface TabsContentProps {
	/** The tab this panel belongs to. */
	readonly value: string;
	readonly children: React.ReactNode;
	/** Extra classes for the panel, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** The chosen tab's panel; the others are not rendered. */
export const TabsContent = React.memo(
	React.forwardRef<View, TabsContentProps>(function TabsContent({ value: tab, children, className, testID }, ref): React.JSX.Element | null {
		const { value } = useTabsContext("TabsContent");
		if (value !== tab) {
			return null;
		}
		return (
			<View ref={ref} testID={testID} className={cn("gap-3", className)}>
				{children}
			</View>
		);
	}),
);
