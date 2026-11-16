import { Button } from "@workspace/ui-native/components/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui-native/components/dialog";
import * as React from "react";

const TITLE = "Scheduled maintenance";
const DESCRIPTION = "The service will be down on Sunday from 02:00 to 04:00 UTC.";

export function Dialog4Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Show notice" variant="outline" onPress={show} />
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogHeader>
					<DialogTitle>{TITLE}</DialogTitle>
					<DialogDescription>{DESCRIPTION}</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button label="Close" variant="outline" onPress={hide} />
				</DialogFooter>
			</Dialog>
		</>
	);
}
