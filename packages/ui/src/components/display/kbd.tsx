import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

const Kbd = React.forwardRef<HTMLElement, React.ComponentProps<"kbd">>(function Kbd({ className, ...props }, ref): React.JSX.Element {
	return (
		<kbd
			ref={ref}
			data-slot="kbd"
			className={cn(
				"pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm bg-muted px-1 font-sans text-xs font-medium text-muted-foreground select-none in-data-[slot=tooltip-content]:bg-background/20 in-data-[slot=tooltip-content]:text-background dark:in-data-[slot=tooltip-content]:bg-background/10 [&_svg:not([class*='size-'])]:size-3",
				className,
			)}
			{...props}
		/>
	);
});

const KbdGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<"div">>(function KbdGroup({ className, ...props }, ref): React.JSX.Element {
	return <div ref={ref} data-slot="kbd-group" className={cn("inline-flex items-center gap-1", className)} {...props} />;
});

export { Kbd, KbdGroup };
