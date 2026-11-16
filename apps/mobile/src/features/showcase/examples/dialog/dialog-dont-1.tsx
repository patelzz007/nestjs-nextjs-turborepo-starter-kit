import { Button } from "@workspace/ui-native/components/button";
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui-native/components/dialog";
import { TextField } from "@workspace/ui-native/components/text-field";
import * as React from "react";

const TITLE = "Settings";
const FIELDS: readonly string[] = ["Name", "Email", "Phone", "Company", "Address", "City", "Postcode", "Country", "Time zone", "Language"];

export function DialogDont1Example(): React.JSX.Element {
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
			<Button label="Edit everything" variant="outline" onPress={show} />
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogHeader>
					<DialogTitle>{TITLE}</DialogTitle>
				</DialogHeader>
				<DialogBody>
					{FIELDS.map((field: string): React.JSX.Element => (
						<TextField key={field} label={field} value={value} onChange={setValue} />
					))}
				</DialogBody>
				<DialogFooter>
					<Button label="Save" onPress={hide} />
				</DialogFooter>
			</Dialog>
		</>
	);
}
