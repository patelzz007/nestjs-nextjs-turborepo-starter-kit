// One line of status — a glyph and a short text — for logs, transcripts and
// summaries, or a labelled divider between phases (the web kit's `Marker`):
// the same parts, Marker, MarkerIcon and MarkerContent.
//
// `variant`: `default` (a line), `separator` (the text between two rules) or
// `border` (a line ruled off from the one below). The glyph is decorative and
// hidden from screen readers — the text alone carries the meaning, so a line
// must read whole without it. With `onPress` the line is a link (or a
// button) of its own, named for what it does. The ref reaches the root view.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { Pressable, Text, type TextInstance, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";

export const markerVariants = cva("min-h-4 w-full flex-row items-center gap-2", {
	variants: {
		variant: { default: "", separator: "", border: "border-b border-border pb-2" },
		pressable: { true: "min-h-11 active:opacity-70", false: "" },
	},
	defaultVariants: { variant: "default", pressable: false },
});

/** The rules either side of a separator's text. */
export const markerRuleVariants = cva("h-px min-w-0 flex-1 bg-border");

export const markerIconVariants = cva("size-4 shrink-0 items-center justify-center");

export const markerContentVariants = cva("text-label shrink font-sans text-muted-foreground", {
	variants: { variant: { default: "", separator: "shrink-0 text-center", border: "" }, link: { true: "underline", false: "" } },
	defaultVariants: { variant: "default", link: false },
});

export type MarkerVariant = NonNullable<VariantProps<typeof markerVariants>["variant"]>;

interface MarkerLook {
	readonly variant: MarkerVariant;
	readonly link: boolean;
}

const MarkerContext = React.createContext<MarkerLook>({ variant: "default", link: false });

interface MarkerPartProps {
	readonly children?: React.ReactNode;
	/** Extra classes, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** A plain line, or a control of its own that must be named. */
export type MarkerInteraction =
	| { readonly onPress?: undefined; readonly accessibilityLabel?: undefined; readonly accessibilityRole?: undefined }
	| {
			readonly onPress: () => void;
			/** What pressing the line does. */
			readonly accessibilityLabel: string;
			/** Default `link`. */
			readonly accessibilityRole?: "link" | "button" | undefined;
	  };

export type MarkerProps = MarkerPartProps &
	MarkerInteraction & {
		readonly variant?: MarkerVariant | undefined;
	};

export const Marker = React.memo(
	React.forwardRef<ViewInstance, MarkerProps>(function Marker(
		{ children, variant = "default", onPress, accessibilityLabel, accessibilityRole = "link", className, testID },
		ref,
	): React.JSX.Element {
		const link = onPress !== undefined && accessibilityRole === "link";
		const look = React.useMemo((): MarkerLook => ({ variant, link }), [link, variant]);
		const body = (
			<MarkerContext.Provider value={look}>
				{variant === "separator" ? <View className={markerRuleVariants()} /> : null}
				{children}
				{variant === "separator" ? <View className={markerRuleVariants()} /> : null}
			</MarkerContext.Provider>
		);
		if (onPress !== undefined) {
			return (
				<Pressable
					ref={ref}
					accessibilityRole={accessibilityRole}
					accessibilityLabel={accessibilityLabel}
					onPress={onPress}
					testID={testID}
					className={cn(markerVariants({ variant, pressable: true }), className)}>
					{body}
				</Pressable>
			);
		}
		return (
			<View ref={ref} testID={testID} className={cn(markerVariants({ variant }), className)}>
				{body}
			</View>
		);
	}),
);

/** The line's glyph (or a spinner), hidden from screen readers. */
export const MarkerIcon = React.memo(
	React.forwardRef<ViewInstance, MarkerPartProps>(function MarkerIcon({ children, className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID={testID} className={cn(markerIconVariants(), className)}>
				{children}
			</View>
		);
	}),
);

/** The line's text: it alone carries the meaning. */
export const MarkerContent = React.memo(
	React.forwardRef<TextInstance, MarkerPartProps>(function MarkerContent({ children, className, testID }, ref): React.JSX.Element {
		const { variant, link } = React.use(MarkerContext);
		return (
			<Text ref={ref} testID={testID} className={cn(markerContentVariants({ variant, link }), className)}>
				{children}
			</Text>
		);
	}),
);
