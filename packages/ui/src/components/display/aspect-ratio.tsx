import { cn } from "@workspace/ui/lib/utils";

function AspectRatio({ ratio, className, ...props }: React.ComponentProps<"div"> & { ratio: number }): React.JSX.Element {
	const aspectStyle: React.CSSProperties & Record<`--${string}`, string | number> = {
		"--ratio": ratio,
	};

	return <div data-slot="aspect-ratio" style={aspectStyle} className={cn("relative aspect-(--ratio)", className)} {...props} />;
}

export { AspectRatio };
