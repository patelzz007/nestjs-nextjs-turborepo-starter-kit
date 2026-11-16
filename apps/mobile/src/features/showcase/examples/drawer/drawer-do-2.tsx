import { Button } from "@workspace/ui-native/components/button";
import { Drawer } from "@workspace/ui-native/components/sheet";
import { TextField } from "@workspace/ui-native/components/text-field";
import * as React from "react";

export function DrawerDo2Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const [note, setNote] = React.useState("");
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Quick note" variant="outline" onPress={show} />
			<Drawer open={open} onOpenChange={setOpen} title="Quick note">
				<TextField label="Note" value={note} onChange={setNote} multiline />
				<Button label="Save" onPress={hide} />
			</Drawer>
		</>
	);
}
