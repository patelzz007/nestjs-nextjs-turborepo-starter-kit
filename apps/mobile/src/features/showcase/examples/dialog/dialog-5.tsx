import { Button } from "@workspace/ui-native/components/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui-native/components/dialog";
import { TextField } from "@workspace/ui-native/components/text-field";
import * as React from "react";

const TITLE = "Edit profile";
const DESCRIPTION = "Make changes to your profile here. Save when you're done.";

export function Dialog5Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const [name, setName] = React.useState("Pedro Duarte");
	const [username, setUsername] = React.useState("@peduarte");
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Edit profile" variant="outline" onPress={show} />
			<Dialog open={open} onOpenChange={setOpen} showCloseButton closeButtonClassName="-right-3 -top-3 border border-border bg-card shadow-md">
				<DialogHeader>
					<DialogTitle>{TITLE}</DialogTitle>
					<DialogDescription>{DESCRIPTION}</DialogDescription>
				</DialogHeader>
				<TextField label="Name" value={name} onChange={setName} />
				<TextField label="Username" value={username} onChange={setUsername} autoCapitalize="none" />
				<DialogFooter layout="row">
					<Button label="Cancel" variant="outline" onPress={hide} className="flex-1" />
					<Button label="Save changes" onPress={hide} className="flex-1" />
				</DialogFooter>
			</Dialog>
		</>
	);
}
