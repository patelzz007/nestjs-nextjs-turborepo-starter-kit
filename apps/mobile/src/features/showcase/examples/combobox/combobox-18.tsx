import ChevronsUpDownIcon from "lucide-react-native/icons/chevrons-up-down";
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

export function Combobox18Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	const clear = React.useCallback((): void => {
		setValue(null);
	}, []);
	return (
		<Combobox label="Framework" options={FRAMEWORKS} value={value} onChange={setValue} placeholder="Select a framework" chevronIcon={ChevronsUpDownIcon} onClear={clear} />
	);
}
