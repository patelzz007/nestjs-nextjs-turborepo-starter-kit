// A dot that breathes — the "live" indicator on the auth panel's brand tile,
// the same as the web panel's `animate-pulse` dot (PULSE in lib/motion.ts).
// Presentational: the caller picks a tone and size, or sizes and colours it
// with `className`. It stays still while the OS "Reduce Motion" setting is on,
// as the web's `motion-safe:` variant does. Decorative: hidden from screen
// readers (the text beside it says what is live).

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import type { View } from "react-native";
import Animated from "react-native-reanimated";
import { withUniwind } from "uniwind";

import { cn } from "../lib/cn";
import { usePulseStyle } from "../lib/use-pulse-style";

/** Reanimated's view with Uniwind's `className` (static classes, animated `style`). */
const StyledAnimatedView = withUniwind(Animated.View);

export const pulseDotVariants = cva("rounded-full", {
	variants: {
		tone: {
			success: "bg-success",
			warning: "bg-warning",
			destructive: "bg-destructive",
			info: "bg-info",
			primary: "bg-primary",
			neutral: "bg-muted-foreground",
		},
		size: { sm: "size-2", md: "size-2.5", lg: "size-4" },
	},
	defaultVariants: { tone: "success", size: "md" },
});

type PulseDotVariantProps = VariantProps<typeof pulseDotVariants>;
export type PulseDotTone = NonNullable<PulseDotVariantProps["tone"]>;
export type PulseDotSize = NonNullable<PulseDotVariantProps["size"]>;

export interface PulseDotProps {
	readonly tone?: PulseDotTone;
	readonly size?: PulseDotSize;
	/** Extra classes, merged last: a token size or colour here wins over `size` / `tone` (`size-4 bg-auth-panel-foreground`). */
	readonly className?: string;
	readonly testID?: string | undefined;
}

export const PulseDot = React.memo(
	React.forwardRef<View, PulseDotProps>(function PulseDot({ tone = "success", size = "md", className, testID }, ref): React.JSX.Element {
		const pulseStyle = usePulseStyle();

		return (
			<StyledAnimatedView
				ref={ref}
				className={cn(pulseDotVariants({ tone, size }), className)}
				style={pulseStyle}
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
				testID={testID}
			/>
		);
	}),
);
