import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@workspace/ui/components/sheet";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldLabel } from "@workspace/ui/components/field";

export function SheetDont2Example(): React.JSX.Element {
	return (
		<Sheet>
			<SheetTrigger render={<Button variant="outline" />}>Filters</SheetTrigger>
			<SheetContent showCloseButton={false}>
				<SheetHeader>
					<SheetTitle>Filter tickets</SheetTitle>
					<SheetDescription>Show only the tickets you need.</SheetDescription>
				</SheetHeader>
				<div className="flex flex-col gap-3 p-4">
					<Field orientation="horizontal">
						<Checkbox id="sheet-dont-2-open" defaultChecked />
						<FieldLabel htmlFor="sheet-dont-2-open">Open</FieldLabel>
					</Field>
					<Field orientation="horizontal">
						<Checkbox id="sheet-dont-2-closed" />
						<FieldLabel htmlFor="sheet-dont-2-closed">Closed</FieldLabel>
					</Field>
				</div>
				<SheetFooter>
					<SheetClose render={<Button />}>Apply</SheetClose>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
