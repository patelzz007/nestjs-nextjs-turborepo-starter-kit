import { Button } from "@workspace/ui-native/components/button";
import { Drawer } from "@workspace/ui-native/components/sheet";
import { TextField } from "@workspace/ui-native/components/text-field";
import * as React from "react";

const FIELDS: readonly string[] = ["Name", "Card number", "Expiry", "CVC", "Address", "City", "Postcode", "Country"];

export function DrawerDont2Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const [value, setValue] = React.useState("");
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Checkout" variant="outline" onPress={show} />
			<Drawer open={open} onOpenChange={setOpen} title="Checkout" side="left">
				{FIELDS.map((field: string): React.JSX.Element => (
					<TextField key={field} label={field} value={value} onChange={setValue} />
				))}
				<Button label="Pay" onPress={hide} />
			</Drawer>
		</>
	);
}
