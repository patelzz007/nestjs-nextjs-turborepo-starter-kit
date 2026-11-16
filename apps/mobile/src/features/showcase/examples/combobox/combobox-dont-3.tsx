import { type ComboboxOption, MultiCombobox } from "@workspace/ui-native/components/combobox";
import * as React from "react";

const FRAMEWORKS: readonly ComboboxOption<string>[] = [
	{ value: "next", label: "Next.js" },
	{ value: "sveltekit", label: "SvelteKit" },
	{ value: "nuxt", label: "Nuxt.js" },
	{ value: "remix", label: "Remix" },
	{ value: "astro", label: "Astro" },
	{ value: "gatsby", label: "Gatsby" },
];

const INITIAL: readonly string[] = ["next", "remix", "astro"];

export function ComboboxDont3Example(): React.JSX.Element {
	const [values, setValues] = React.useState<readonly string[]>(INITIAL);
	return <MultiCombobox label="Frameworks" options={FRAMEWORKS} values={values} onChange={setValues} chips="none" />;
}
