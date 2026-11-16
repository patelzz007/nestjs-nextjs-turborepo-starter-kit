import BluetoothIcon from "lucide-react-native/icons/bluetooth";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { Button } from "@workspace/ui-native/components/button";
import { AlertDialog } from "@workspace/ui-native/components/alert-dialog";
import * as React from "react";

const MEDIA = <IconTile icon={BluetoothIcon} tone="blue" size="md" />;

export function AlertDialog3Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Pair device" variant="outline" onPress={show} />
			<AlertDialog
				visible={open}
				onConfirm={hide}
				onCancel={hide}
				title="Pair Bluetooth device?"
				description="“Ava's AirPods” wants to pair with this phone."
				confirmLabel="Pair"
				cancelLabel="Cancel"
				media={MEDIA}
			/>
		</>
	);
}
