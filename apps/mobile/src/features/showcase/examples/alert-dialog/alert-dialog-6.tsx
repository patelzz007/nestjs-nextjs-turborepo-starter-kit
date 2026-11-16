import { Button } from "@workspace/ui-native/components/button";
import { AlertDialog } from "@workspace/ui-native/components/alert-dialog";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui-native/components/dialog";
import * as React from "react";

const TITLE = "Team settings";
const DESCRIPTION = "Removing the team signs every member out of its projects.";

export function AlertDialog6Example(): React.JSX.Element {
	const [dialogOpen, setDialogOpen] = React.useState(false);
	const [confirming, setConfirming] = React.useState(false);
	const showDialog = React.useCallback((): void => {
		setDialogOpen(true);
	}, []);
	const askToRemove = React.useCallback((): void => {
		setConfirming(true);
	}, []);
	const cancel = React.useCallback((): void => {
		setConfirming(false);
	}, []);
	const remove = React.useCallback((): void => {
		setConfirming(false);
		setDialogOpen(false);
	}, []);
	return (
		<>
			<Button label="Team settings" variant="outline" onPress={showDialog} />
			<Dialog open={dialogOpen} onOpenChange={setDialogOpen} showCloseButton>
				<DialogHeader>
					<DialogTitle>{TITLE}</DialogTitle>
					<DialogDescription>{DESCRIPTION}</DialogDescription>
				</DialogHeader>
				<Button label="Remove team" variant="destructive" onPress={askToRemove} />
				<AlertDialog
					visible={confirming}
					title="Remove the team?"
					description="Its 8 members lose access at once."
					confirmLabel="Remove"
					cancelLabel="Keep"
					onConfirm={remove}
					onCancel={cancel}
					destructive
				/>
			</Dialog>
		</>
	);
}
