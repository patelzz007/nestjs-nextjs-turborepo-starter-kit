import { Button } from "@workspace/ui-native/components/button";
import { Sheet } from "@workspace/ui-native/components/sheet";
import { Switch } from "@workspace/ui-native/components/switch";
import * as React from "react";

export function SheetDo1Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const [unread, setUnread] = React.useState(false);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	const footer = (
		<>
			<Button label="Apply" onPress={hide} />
			<Button label="Cancel" variant="outline" onPress={hide} />
		</>
	);
	return (
		<>
			<Button label="Filters" variant="outline" onPress={show} />
			<Sheet open={open} onOpenChange={setOpen} title="Filters" footer={footer}>
				<Switch label="Unread only" checked={unread} onChange={setUnread} />
			</Sheet>
		</>
	);
}
