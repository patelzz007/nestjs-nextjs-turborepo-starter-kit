"use client";

import { cn } from "@workspace/ui/lib/utils";
import * as React from "react";

const Label = React.forwardRef<HTMLLabelElement, React.ComponentProps<"label">>(function Label({ className, ...props }, ref): React.JSX.Element {
	return (
		<label
			ref={ref}
			data-slot="label"
			className={cn(
				"flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
				className,
			)}
			{...props}
		/>
	);
});

export { Label };
