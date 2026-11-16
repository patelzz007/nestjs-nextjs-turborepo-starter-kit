import KeyboardIcon from "lucide-react-native/icons/keyboard";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { Button } from "@workspace/ui-native/components/button";
import { AlertDialog } from "@workspace/ui-native/components/alert-dialog";
import * as React from "react";

const MEDIA = <IconTile icon={KeyboardIcon} tone="neutral" size="md" />;

export function AlertDialog4Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Connect keyboard" variant="outline" onPress={show} />
			<AlertDialog
				visible={open}
				onConfirm={hide}
				onCancel={hide}
				title="Use this keyboard?"
				description="Connect the Magic Keyboard found nearby."
				confirmLabel="Connect"
				cancelLabel="Not now"
				media={MEDIA}
				size="sm"
				actionsLayout="row"
				align="center"
			/>
		</>
	);
}
