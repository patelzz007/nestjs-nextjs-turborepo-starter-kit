import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@workspace/ui/components/popover";

export function PopoverDont1Example(): React.JSX.Element {
	return (
		<Popover>
			<PopoverTrigger render={<Button variant="outline" />}>?</PopoverTrigger>
			<PopoverContent className="w-56">
				<PopoverHeader>
					<PopoverTitle>This button exports the report.</PopoverTitle>
				</PopoverHeader>
			</PopoverContent>
		</Popover>
	);
}
