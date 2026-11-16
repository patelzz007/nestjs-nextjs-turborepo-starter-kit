import { Button } from "@workspace/ui-native/components/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui-native/components/dialog";
import * as React from "react";

const TITLE = "Delete project?";
const DESCRIPTION = "This cannot be undone.";

export function DialogDo2Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Delete project" variant="destructive" onPress={show} />
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogHeader>
					<DialogTitle>{TITLE}</DialogTitle>
					<DialogDescription>{DESCRIPTION}</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button label="Delete project" variant="destructive" onPress={hide} />
					<Button label="Cancel" variant="outline" onPress={hide} />
				</DialogFooter>
			</Dialog>
		</>
	);
}
