import { Button } from "@workspace/ui-native/components/button";
import { Drawer } from "@workspace/ui-native/components/sheet";
import { Text } from "react-native";
import * as React from "react";

const BODY = "Swipe left to close. A tap outside closes it too.";

export function Drawer3Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	return (
		<>
			<Button label="Open from the left" variant="outline" onPress={show} />
			<Drawer open={open} onOpenChange={setOpen} side="left" title="Notifications">
				<Text className="text-body font-sans text-muted-foreground">{BODY}</Text>
			</Drawer>
		</>
	);
}
