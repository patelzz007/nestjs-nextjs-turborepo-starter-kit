import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@workspace/ui/components/popover";

export function Popover1Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Popover>
				<PopoverTrigger render={<Button variant="outline" className="w-fit" />}>Open Popover</PopoverTrigger>
				<PopoverContent align="start" className="px-3 py-2">
					<PopoverHeader>
						<PopoverTitle>Dimensions</PopoverTitle>
						<PopoverDescription>Set the dimensions for the layer.</PopoverDescription>
					</PopoverHeader>
				</PopoverContent>
			</Popover>
		</div>
	);
}
