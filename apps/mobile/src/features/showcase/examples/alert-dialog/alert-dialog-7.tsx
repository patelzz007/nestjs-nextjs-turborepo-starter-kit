import CircleCheckIcon from "lucide-react-native/icons/circle-check";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { Checkbox } from "@workspace/ui-native/components/checkbox";
import { Button } from "@workspace/ui-native/components/button";
import { AlertDialog } from "@workspace/ui-native/components/alert-dialog";
import * as React from "react";

const MEDIA = <IconTile icon={CircleCheckIcon} tone="green" size="md" />;

export function AlertDialog7Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const [hideNextTime, setHideNextTime] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Finish task" variant="outline" onPress={show} />
			<AlertDialog
				visible={open}
				onConfirm={hide}
				onCancel={hide}
				title="Task completed"
				description="Your export is ready in Downloads."
				confirmLabel="Done"
				media={MEDIA}
				align="center">
				<Checkbox label="Don't show this again" checked={hideNextTime} onChange={setHideNextTime} />
			</AlertDialog>
		</>
	);
}
