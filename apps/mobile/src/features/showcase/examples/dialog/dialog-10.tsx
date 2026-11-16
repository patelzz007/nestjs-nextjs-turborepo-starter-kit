import { Button } from "@workspace/ui-native/components/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui-native/components/dialog";
import * as React from "react";

const TITLE = "Session expired";
const DESCRIPTION = "For your security you were signed out after 30 minutes without activity.";

export function Dialog10Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Show timeout" variant="outline" onPress={show} />
			<Dialog open={open} onOpenChange={setOpen} dismissible={false}>
				<DialogHeader>
					<DialogTitle>{TITLE}</DialogTitle>
					<DialogDescription>{DESCRIPTION}</DialogDescription>
				</DialogHeader>
				<Button label="Sign in again" onPress={hide} />
			</Dialog>
		</>
	);
}
