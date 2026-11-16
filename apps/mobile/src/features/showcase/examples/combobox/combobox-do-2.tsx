import { Combobox, type ComboboxOption } from "@workspace/ui-native/components/combobox";
import * as React from "react";

const FRAMEWORKS: readonly ComboboxOption<string>[] = [
	{ value: "next", label: "Next.js" },
	{ value: "sveltekit", label: "SvelteKit" },
	{ value: "nuxt", label: "Nuxt.js" },
	{ value: "remix", label: "Remix" },
	{ value: "astro", label: "Astro" },
	{ value: "gatsby", label: "Gatsby" },
];

export function ComboboxDo2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return (
		<Combobox
			label="Framework"
			options={FRAMEWORKS}
			value={value}
			onChange={setValue}
			placeholder="Select a framework"
			noMatchesMessage="No framework matches. Check the spelling or try its short name."
		/>
	);
}
