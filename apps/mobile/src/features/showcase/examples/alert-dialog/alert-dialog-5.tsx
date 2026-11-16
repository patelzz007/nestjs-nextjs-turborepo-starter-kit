import Trash2Icon from "lucide-react-native/icons/trash-2";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import { Button } from "@workspace/ui-native/components/button";
import { AlertDialog } from "@workspace/ui-native/components/alert-dialog";
import * as React from "react";

const MEDIA = <IconTile icon={Trash2Icon} tone="red" size="md" />;

export function AlertDialog5Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Delete file" variant="destructive" onPress={show} />
			<AlertDialog
				visible={open}
				onConfirm={hide}
				onCancel={hide}
				title="Delete “Q3 report.pdf”?"
				description="The file goes for good, with its 4 shared links. Read how sharing works at acme.com/help/sharing."
				confirmLabel="Delete"
				cancelLabel="Cancel"
				media={MEDIA}
				destructive
			/>
		</>
	);
}
