// A hairline between groups of content: across a list (`horizontal`) or
// between items in a row (`vertical`). Decorative, so screen readers skip it —
// the grouping is already in the content it divides.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { View } from "react-native";

import { cn } from "../lib/cn";

export const separatorVariants = cva("shrink-0 bg-border", {
	variants: {
		orientation: {
			horizontal: "h-px w-full",
			vertical: "w-px self-stretch",
		},
	},
	defaultVariants: { orientation: "horizontal" },
});

export type SeparatorOrientation = NonNullable<VariantProps<typeof separatorVariants>["orientation"]>;

export interface SeparatorProps {
	readonly orientation?: SeparatorOrientation;
	/** Extra classes, merged last (spacing: `my-2`; a stronger line: `bg-muted-foreground`). */
	readonly className?: string;
	readonly testID?: string;
}

export const Separator = React.memo(
	React.forwardRef<View, SeparatorProps>(function Separator({ orientation = "horizontal", className, testID }, ref): React.JSX.Element {
		return (
			<View
				ref={ref}
				accessibilityElementsHidden
				importantForAccessibility="no-hide-descendants"
				testID={testID}
				className={cn(separatorVariants({ orientation }), className)}
			/>
		);
	}),
);
