import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";

type Side = NonNullable<React.ComponentProps<typeof PopoverContent>["side"]>;

const sides: readonly Side[] = ["inline-start", "left", "top", "bottom", "right", "inline-end"];

export function Popover2Example(): React.JSX.Element {
	return (
		<div className="grid grid-cols-3 gap-2">
			{sides.map((side: Side): React.JSX.Element => (
				<Popover key={side}>
					<PopoverTrigger render={<Button variant="outline" className="w-full capitalize" />}>{side.replace("-", " ")}</PopoverTrigger>
					<PopoverContent side={side} className="w-40">
						<p>Popover on {side.replace("-", " ")}</p>
					</PopoverContent>
				</Popover>
			))}
		</div>
	);
}
