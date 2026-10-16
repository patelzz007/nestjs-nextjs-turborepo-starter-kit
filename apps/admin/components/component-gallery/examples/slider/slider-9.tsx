import * as React from "react";
import { Label } from "@workspace/ui/components/label";
import { Slider } from "@workspace/ui/components/slider";

export function Slider9Example(): React.JSX.Element {
	return (
		<div className="mx-auto grid w-full max-w-sm gap-4">
			<Label className="text-sm font-medium">Storage</Label>
			<Slider defaultValue={15} max={35} min={5} />
			<span aria-hidden="true" className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground">
				<span>5 GB</span>
				<span>20 GB</span>
				<span>35 GB</span>
			</span>
		</div>
	);
}
