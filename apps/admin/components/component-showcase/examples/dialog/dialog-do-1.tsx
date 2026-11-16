import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function DialogDo1Example(): React.JSX.Element {
	return (
		<Dialog>
			<DialogTrigger render={<Button variant="outline" />}>Rename project</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Rename project</DialogTitle>
					<DialogDescription>The new name shows everywhere the project appears.</DialogDescription>
				</DialogHeader>
				<Field>
					<FieldLabel htmlFor="dialog-do-1-name">Name</FieldLabel>
					<Input id="dialog-do-1-name" defaultValue="Website relaunch" />
				</Field>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
					<DialogClose render={<Button />}>Rename</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
