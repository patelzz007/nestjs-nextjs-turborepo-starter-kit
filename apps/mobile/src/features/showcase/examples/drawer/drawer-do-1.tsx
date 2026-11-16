import { Button } from "@workspace/ui-native/components/button";
import { Drawer } from "@workspace/ui-native/components/sheet";
import { View } from "react-native";
import * as React from "react";

export function DrawerDo1Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Share" variant="outline" onPress={show} />
			<Drawer open={open} onOpenChange={setOpen} title="Share">
				<View className="gap-2">
					<Button label="Copy link" variant="outline" onPress={hide} />
					<Button label="Send by email" variant="outline" onPress={hide} />
				</View>
			</Drawer>
		</>
	);
}
