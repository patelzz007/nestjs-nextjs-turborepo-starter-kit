import { cn } from "@workspace/ui/lib/core/utils";
import * as React from "react";

type AspectRatioStyle = React.CSSProperties & Record<`--${string}`, string | number>;

interface AspectRatioProps extends React.ComponentProps<"div"> {
	/** Width divided by height, e.g. `16 / 9`. */
	readonly ratio: number;
}

const AspectRatio = React.forwardRef<HTMLDivElement, AspectRatioProps>(function AspectRatio({ ratio, className, style, ...props }, ref): React.JSX.Element {
	// One style object per ratio/style change, not per render.
	const aspectStyle = React.useMemo((): AspectRatioStyle => ({ ...style, "--ratio": ratio }), [ratio, style]);

	return <div ref={ref} data-slot="aspect-ratio" style={aspectStyle} className={cn("relative aspect-(--ratio)", className)} {...props} />;
});

export { AspectRatio, type AspectRatioProps };
