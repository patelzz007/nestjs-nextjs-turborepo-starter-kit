import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@workspace/ui/components/popover";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function PopoverDo2Example(): React.JSX.Element {
	return (
		<Popover>
			<PopoverTrigger render={<Button variant="outline" />}>Dimensions</PopoverTrigger>
			<PopoverContent align="start" className="flex w-72 flex-col gap-3">
				<PopoverHeader>
					<PopoverTitle>Dimensions</PopoverTitle>
					<PopoverDescription>Set the layer&apos;s size.</PopoverDescription>
				</PopoverHeader>
				<div className="grid grid-cols-2 gap-2">
					<Field>
						<FieldLabel htmlFor="popover-do-2-width">Width</FieldLabel>
						<Input id="popover-do-2-width" defaultValue="320" />
					</Field>
					<Field>
						<FieldLabel htmlFor="popover-do-2-height">Height</FieldLabel>
						<Input id="popover-do-2-height" defaultValue="180" />
					</Field>
				</div>
			</PopoverContent>
		</Popover>
	);
}
