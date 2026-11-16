import { Button } from "@workspace/ui-native/components/button";
import { Combobox, type ComboboxOption } from "@workspace/ui-native/components/combobox";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui-native/components/dialog";
import * as React from "react";

const FRAMEWORKS: readonly ComboboxOption<string>[] = [
	{ value: "next", label: "Next.js" },
	{ value: "sveltekit", label: "SvelteKit" },
	{ value: "nuxt", label: "Nuxt.js" },
	{ value: "remix", label: "Remix" },
	{ value: "astro", label: "Astro" },
	{ value: "gatsby", label: "Gatsby" },
];

const TITLE = "Choose a framework";
const DESCRIPTION = "The project starts from this framework's template.";

export function Combobox17Example(): React.JSX.Element {
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
			<Button label="New project" variant="outline" onPress={show} />
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogHeader>
					<DialogTitle>{TITLE}</DialogTitle>
					<DialogDescription>{DESCRIPTION}</DialogDescription>
				</DialogHeader>
				<Combobox label="Framework" hideLabel options={FRAMEWORKS} value={value} onChange={setValue} placeholder="Select a framework" />
				<DialogFooter>
					<Button label="Cancel" variant="outline" onPress={hide} />
					<Button label="Confirm" disabled={value === null} onPress={hide} />
				</DialogFooter>
			</Dialog>
		</>
	);
}
