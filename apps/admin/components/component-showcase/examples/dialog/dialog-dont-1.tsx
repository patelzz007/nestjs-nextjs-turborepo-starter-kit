import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function DialogDont1Example(): React.JSX.Element {
	return (
		<Dialog>
			<DialogTrigger render={<Button variant="outline" />}>Add customer</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add customer</DialogTitle>
					<DialogDescription>Every detail we keep about a customer.</DialogDescription>
				</DialogHeader>
				<FieldGroup className="max-h-80 overflow-y-auto">
					<Field>
						<FieldLabel htmlFor="dialog-dont-1-first">First name</FieldLabel>
						<Input id="dialog-dont-1-first" />
					</Field>
					<Field>
						<FieldLabel htmlFor="dialog-dont-1-last">Last name</FieldLabel>
						<Input id="dialog-dont-1-last" />
					</Field>
					<Field>
						<FieldLabel htmlFor="dialog-dont-1-email">Email</FieldLabel>
						<Input id="dialog-dont-1-email" />
					</Field>
					<Field>
						<FieldLabel htmlFor="dialog-dont-1-phone">Phone</FieldLabel>
						<Input id="dialog-dont-1-phone" />
					</Field>
					<Field>
						<FieldLabel htmlFor="dialog-dont-1-street">Street</FieldLabel>
						<Input id="dialog-dont-1-street" />
					</Field>
					<Field>
						<FieldLabel htmlFor="dialog-dont-1-city">City</FieldLabel>
						<Input id="dialog-dont-1-city" />
					</Field>
					<Field>
						<FieldLabel htmlFor="dialog-dont-1-postcode">Postcode</FieldLabel>
						<Input id="dialog-dont-1-postcode" />
					</Field>
					<Field>
						<FieldLabel htmlFor="dialog-dont-1-country">Country</FieldLabel>
						<Input id="dialog-dont-1-country" />
					</Field>
					<Field>
						<FieldLabel htmlFor="dialog-dont-1-company">Company</FieldLabel>
						<Input id="dialog-dont-1-company" />
					</Field>
					<Field>
						<FieldLabel htmlFor="dialog-dont-1-vat">VAT number</FieldLabel>
						<Input id="dialog-dont-1-vat" />
					</Field>
				</FieldGroup>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
					<DialogClose render={<Button />}>Save</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
