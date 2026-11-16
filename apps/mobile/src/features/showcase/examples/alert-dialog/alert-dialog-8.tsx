import UserXIcon from "lucide-react-native/icons/user-x";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { Button } from "@workspace/ui-native/components/button";
import { AlertDialog } from "@workspace/ui-native/components/alert-dialog";
import * as React from "react";

const MEDIA = <IconTile icon={UserXIcon} tone="red" size="md" />;

export function AlertDialog8Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Deactivate account" variant="destructive" onPress={show} />
			<AlertDialog
				visible={open}
				onConfirm={hide}
				onCancel={hide}
				title="Deactivate your account?"
				description="Your profile is hidden and you are signed out everywhere. Sign in again within 30 days to undo it."
				confirmLabel="Deactivate"
				cancelLabel="Cancel"
				media={MEDIA}
				mediaPlacement="start"
				destructive
			/>
		</>
	);
}
