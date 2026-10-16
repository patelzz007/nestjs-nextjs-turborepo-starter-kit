import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@workspace/ui/components/popover";

export function Popover3Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Popover>
				<PopoverTrigger render={<Button variant="outline" />}>Open Popover</PopoverTrigger>
				<PopoverContent className="w-64" align="start">
					<PopoverHeader>
						<PopoverTitle>Dimensions</PopoverTitle>
						<PopoverDescription>Set the dimensions for the layer.</PopoverDescription>
					</PopoverHeader>
					<FieldGroup className="gap-2">
						<Field orientation="horizontal">
							<FieldLabel htmlFor="width" className="w-1/2">
								Width
							</FieldLabel>
							<Input id="width" defaultValue="100%" />
						</Field>
						<Field orientation="horizontal">
							<FieldLabel htmlFor="height" className="w-1/2">
								Height
							</FieldLabel>
							<Input id="height" defaultValue="25px" />
						</Field>
					</FieldGroup>
				</PopoverContent>
			</Popover>
		</div>
	);
}
