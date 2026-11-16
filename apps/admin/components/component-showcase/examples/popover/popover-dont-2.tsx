import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@workspace/ui/components/popover";
import { Input } from "@workspace/ui/components/input";

const ADDRESS_FIELDS: readonly string[] = ["Full name", "Company", "Street", "Apartment", "City", "State", "Postcode", "Country", "Phone", "Delivery notes"];

export function PopoverDont2Example(): React.JSX.Element {
	return (
		<Popover>
			<PopoverTrigger render={<Button variant="outline" />}>Edit address</PopoverTrigger>
			<PopoverContent align="start" className="flex w-72 flex-col gap-3">
				<PopoverHeader>
					<PopoverTitle>Address</PopoverTitle>
					<PopoverDescription>Where we ship to.</PopoverDescription>
				</PopoverHeader>
				<div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
					{ADDRESS_FIELDS.map((field: string): React.JSX.Element => (
						<Input key={field} aria-label={field} placeholder={field} />
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}
