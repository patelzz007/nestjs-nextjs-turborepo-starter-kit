import { Button } from "@workspace/ui-native/components/button";
import { Sheet } from "@workspace/ui-native/components/sheet";
import { Text } from "react-native";
import * as React from "react";

const BODY = "Delete this file?";

export function SheetDont1Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	const footer = (
		<>
			<Button label="Delete" onPress={hide} />
			<Button label="Cancel" variant="outline" onPress={hide} />
		</>
	);
	return (
		<>
			<Button label="Confirm delete" variant="destructive" onPress={show} />
			<Sheet open={open} onOpenChange={setOpen} side="right" title="Delete" footer={footer}>
				<Text className="text-body font-sans text-foreground">{BODY}</Text>
			</Sheet>
		</>
	);
}
