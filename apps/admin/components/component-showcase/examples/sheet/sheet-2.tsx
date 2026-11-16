import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@workspace/ui/components/sheet";

export function Sheet2Example(): React.JSX.Element {
	return (
		<div className="flex items-center justify-center">
			<Sheet>
				<SheetTrigger render={<Button variant="outline" />}>With No Close Button</SheetTrigger>
				<SheetContent showCloseButton={false}>
					<SheetHeader>
						<SheetTitle>Edit profile</SheetTitle>
						<SheetDescription>Make changes to your profile here. Click save when you&apos;re done.</SheetDescription>
					</SheetHeader>
					<div className="p-4">
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="name">Name</FieldLabel>
								<Input id="name" defaultValue="John Doe" />
							</Field>
							<Field>
								<FieldLabel htmlFor="username">Username</FieldLabel>
								<Input id="username" defaultValue="@john-doe" />
							</Field>
						</FieldGroup>
					</div>
					<SheetFooter>
						<Button type="submit">Save changes</Button>
						<SheetClose render={<Button variant="outline" />}>Cancel</SheetClose>
					</SheetFooter>
				</SheetContent>
			</Sheet>
		</div>
	);
}
