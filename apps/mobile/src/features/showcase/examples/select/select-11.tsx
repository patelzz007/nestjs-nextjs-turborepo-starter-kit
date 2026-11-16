import { Button } from "@workspace/ui-native/components/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui-native/components/dialog";
import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";

const FRUITS: readonly SelectOption<string>[] = [
	{ value: "apple", label: "Apple" },
	{ value: "banana", label: "Banana" },
	{ value: "blueberry", label: "Blueberry" },
	{ value: "grapes", label: "Grapes" },
	{ value: "pineapple", label: "Pineapple" },
];

const TITLE = "Choose a fruit";
const DESCRIPTION = "Pick the fruit for your order.";

export function Select11Example(): React.JSX.Element {
	const [open, setOpen] = React.useState(false);
	const [value, setValue] = React.useState<string | null>(null);
	const show = React.useCallback((): void => {
		setOpen(true);
	}, []);
	const hide = React.useCallback((): void => {
		setOpen(false);
	}, []);
	return (
		<>
			<Button label="Open dialog" variant="outline" onPress={show} />
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogHeader>
					<DialogTitle>{TITLE}</DialogTitle>
					<DialogDescription>{DESCRIPTION}</DialogDescription>
				</DialogHeader>
				<SelectField label="Fruit" options={FRUITS} value={value} onChange={setValue} placeholder="Select a fruit" />
				<DialogFooter>
					<Button label="Done" onPress={hide} />
				</DialogFooter>
			</Dialog>
		</>
	);
}
