import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog";

export function DialogDont2Example(): React.JSX.Element {
	return (
		<Dialog>
			<DialogTrigger render={<Button variant="outline" />}>Delete</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Are you sure?</DialogTitle>
					<DialogDescription>Please confirm.</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
					<DialogClose render={<Button />}>OK</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
