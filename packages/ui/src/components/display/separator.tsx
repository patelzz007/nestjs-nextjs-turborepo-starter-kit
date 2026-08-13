"use client";

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

const Separator = React.forwardRef<HTMLDivElement, SeparatorPrimitive.Props>(function Separator({ className, orientation = "horizontal", ...props }, ref): React.JSX.Element {
	return (
		<SeparatorPrimitive
			ref={ref}
			data-slot="separator"
			orientation={orientation}
			className={cn("shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch", className)}
			{...props}
		/>
	);
});

export { Separator };
