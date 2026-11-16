import { Button } from "@workspace/ui-native/components/button";
import { Sheet } from "@workspace/ui-native/components/sheet";
import { TextField } from "@workspace/ui-native/components/text-field";
import * as React from "react";

export function Sheet2Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const [name, setName] = React.useState("Pedro Duarte");
	const [username, setUsername] = React.useState("@peduarte");
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	const footer = (
		<>
			<Button label="Save changes" onPress={hide} />
			<Button label="Cancel" variant="outline" onPress={hide} />
		</>
	);
	return (
		<>
			<Button label="Open sheet" variant="outline" onPress={show} />
			<Sheet
				open={open}
				onOpenChange={setOpen}
				title="Edit profile"
				description="Make changes to your profile here. Save when you're done."
				footer={footer}
				showCloseButton={false}>
				<TextField label="Name" value={name} onChange={setName} />
				<TextField label="Username" value={username} onChange={setUsername} autoCapitalize="none" />
			</Sheet>
		</>
	);
}
