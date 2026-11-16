import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";

const FRAMEWORKS: readonly SelectOption<string>[] = [
	{ value: "next", label: "Next.js" },
	{ value: "remix", label: "Remix" },
	{ value: "astro", label: "Astro" },
	{ value: "nuxt", label: "Nuxt" },
	{ value: "sveltekit", label: "SvelteKit" },
];

export function Select21Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("next");
	const clear = React.useCallback((): void => {
		setValue(null);
	}, []);
	return <SelectField label="Framework" options={FRAMEWORKS} value={value} onChange={setValue} onClear={clear} placeholder="Select a framework" />;
}
