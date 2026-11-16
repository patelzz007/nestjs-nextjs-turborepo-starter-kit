import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog";

export function DialogDo2Example(): React.JSX.Element {
	return (
		<Dialog>
			<DialogTrigger render={<Button variant="outline" />}>Delete project</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete “Website relaunch”?</DialogTitle>
					<DialogDescription>Its 42 tasks and files are deleted for everyone. This cannot be undone.</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<DialogClose render={<Button variant="outline" />}>Keep project</DialogClose>
					<DialogClose render={<Button variant="destructive" />}>Delete project</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
