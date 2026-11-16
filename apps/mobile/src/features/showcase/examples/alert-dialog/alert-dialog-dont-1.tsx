import { Button } from "@workspace/ui-native/components/button";
import { AlertDialog } from "@workspace/ui-native/components/alert-dialog";
import * as React from "react";

export function AlertDialogDont1Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Delete account" variant="destructive" onPress={show} />
			<AlertDialog visible={open} onConfirm={hide} onCancel={hide} title="Confirm" description="Do you want to continue?" confirmLabel="Yes" cancelLabel="No" />
		</>
	);
}
