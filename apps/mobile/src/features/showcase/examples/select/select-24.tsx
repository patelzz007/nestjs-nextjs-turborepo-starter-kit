import { SelectField, type SelectOption } from "@workspace/ui-native/components/select-field";
import * as React from "react";

const TECH: readonly SelectOption<string>[] = [
	{ value: "react", label: "React", group: "Frontend" },
	{ value: "vue", label: "Vue", group: "Frontend" },
	{ value: "svelte", label: "Svelte", group: "Frontend" },
	{ value: "node", label: "Node.js", group: "Backend" },
	{ value: "go", label: "Go", group: "Backend" },
	{ value: "rust", label: "Rust", group: "Backend" },
];

export function Select24Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return <SelectField label="Technology" options={TECH} value={value} onChange={setValue} placeholder="Select a technology" groupSeparators />;
}
