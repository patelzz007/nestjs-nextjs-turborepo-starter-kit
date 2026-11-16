import * as React from "react";
import { cn } from "@workspace/ui/lib/core/utils";
import { Label } from "@workspace/ui/components/label";
import { Slider } from "@workspace/ui/components/slider";

export function Slider10Example(): React.JSX.Element {
	const max = 12;
	const skipInterval = 2;
	const ticks = Array.from({ length: max + 1 }, (_, i) => i);

	return (
		<div className="mx-auto grid w-full max-w-sm gap-4">
			<Label className="text-sm font-medium">Duration (months)</Label>
			<Slider defaultValue={5} max={max} />
			<span aria-hidden="true" className="flex w-full items-center justify-between gap-1 px-2.5 text-xs font-medium text-muted-foreground">
				{ticks.map((tick) => (
					<span key={tick} className="flex w-0 flex-col items-center justify-center gap-2">
						<span className={cn("h-1 w-px bg-muted-foreground/70", tick % skipInterval !== 0 && "h-0.5")} />
						<span className={cn(tick % skipInterval !== 0 && "opacity-0")}>{tick}</span>
					</span>
				))}
			</span>
		</div>
	);
}
