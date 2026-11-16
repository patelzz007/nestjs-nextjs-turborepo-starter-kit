import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@workspace/ui/components/alert-dialog";

export function AlertDialogDont2Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const close = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger render={<Button variant="outline">Save</Button>} />
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Saved</AlertDialogTitle>
					<AlertDialogDescription>Your changes were saved.</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Close</AlertDialogCancel>
					<AlertDialogAction onClick={close}>OK</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
