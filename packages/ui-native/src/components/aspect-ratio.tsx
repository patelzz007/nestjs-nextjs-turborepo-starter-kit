// A box whose height follows its width at a fixed ratio (`16 / 9` for a cover
// picture, `1` for a square), so media reserves its space before it loads and
// nothing moves when it arrives. It takes the width its parent gives it; the
// child fills it (`size-full`, or `absolute inset-0`).

import { cva } from "class-variance-authority";
import * as React from "react";
import { View, type ViewInstance, type ViewStyle } from "react-native";

import { cn } from "../lib/cn";

export const aspectRatioVariants = cva("relative w-full overflow-hidden");

export interface AspectRatioProps {
	/** Width divided by height: `16 / 9`, `4 / 3`, `1`. */
	readonly ratio: number;
	readonly children?: React.ReactNode;
	/** Extra classes, merged last (rounding: `rounded-xl`; a narrower box: `w-1/2`). */
	readonly className?: string;
	readonly testID?: string;
}

export const AspectRatio = React.memo(
	React.forwardRef<ViewInstance, AspectRatioProps>(function AspectRatio({ ratio, children, className, testID }, ref): React.JSX.Element {
		// The ratio is a caller's number, not a token, so it is the one value set as a style; one object per ratio.
		const ratioStyle = React.useMemo((): ViewStyle => ({ aspectRatio: ratio }), [ratio]);
		return (
			<View ref={ref} style={ratioStyle} testID={testID} className={cn(aspectRatioVariants(), className)}>
				{children}
			</View>
		);
	}),
);
