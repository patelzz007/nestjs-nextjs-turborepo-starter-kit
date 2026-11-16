import { Button } from "@workspace/ui-native/components/button";
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui-native/components/dialog";
import { TextField } from "@workspace/ui-native/components/text-field";
import * as React from "react";

const TITLE = "Rename file";

export function DialogDo1Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const [name, setName] = React.useState("Q3 report");
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Rename file" variant="outline" onPress={show} />
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogHeader>
					<DialogTitle>{TITLE}</DialogTitle>
				</DialogHeader>
				<TextField label="Name" value={name} onChange={setName} />
				<DialogFooter>
					<Button label="Rename" onPress={hide} />
					<Button label="Cancel" variant="outline" onPress={hide} />
				</DialogFooter>
			</Dialog>
		</>
	);
}
