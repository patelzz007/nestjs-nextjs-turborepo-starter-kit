import { Button } from "@workspace/ui-native/components/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui-native/components/dialog";
import { Popover } from "@workspace/ui-native/components/popover";
import * as React from "react";
import { Text, View } from "react-native";

import { ignorePress } from "../example-support";

const TITLE = "Share project";
const DESCRIPTION = "Anyone with the link can view it.";

const CONTENT = (
	<View className="gap-1">
		<Text className="text-body-lg font-sans-semibold text-foreground">Dimensions</Text>
		<Text className="text-body font-sans text-muted-foreground">Set the dimensions for the layer.</Text>
	</View>
);

export function Popover5Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	return (
		<>
			<Button label="Open dialog" variant="outline" onPress={show} />
			<Dialog open={open} onOpenChange={setOpen} showCloseButton>
				<DialogHeader>
					<DialogTitle>{TITLE}</DialogTitle>
					<DialogDescription>{DESCRIPTION}</DialogDescription>
				</DialogHeader>
				<Popover content={CONTENT} accessibilityLabel="Dimensions">
					<Button label="Open popover" variant="outline" onPress={ignorePress} />
				</Popover>
			</Dialog>
		</>
	);
}
