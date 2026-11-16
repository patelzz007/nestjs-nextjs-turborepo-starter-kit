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

export function AlertDialogDo1Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const close = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger render={<Button variant="outline">Remove member</Button>} />
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Remove Ada from the workspace?</AlertDialogTitle>
					<AlertDialogDescription>She loses access to its 12 projects at once. Her work stays.</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Keep Ada</AlertDialogCancel>
					<AlertDialogAction onClick={close}>Remove Ada</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
