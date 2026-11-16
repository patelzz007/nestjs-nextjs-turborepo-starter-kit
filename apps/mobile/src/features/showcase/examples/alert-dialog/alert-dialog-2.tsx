import { Button } from "@workspace/ui-native/components/button";
import { AlertDialog } from "@workspace/ui-native/components/alert-dialog";
import * as React from "react";

export function AlertDialog2Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Allow access" variant="outline" onPress={show} />
			<AlertDialog
				visible={open}
				onConfirm={hide}
				onCancel={hide}
				title="Allow accessory to connect?"
				description="Do you want to allow the USB accessory to connect to this device?"
				confirmLabel="Allow"
				cancelLabel="Don't allow"
				size="sm"
				actionsLayout="row"
			/>
		</>
	);
}
