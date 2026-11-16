import { Cascader, type CascaderLabels } from "@workspace/ui-native/components/cascader";
import type { CascaderNode } from "@workspace/ui-native/lib/cascader";
import * as React from "react";

const GERMAN: Partial<CascaderLabels> = {
	search: "Suchen",
	back: "Zurück",
	loading: "Wird geladen…",
	empty: "Keine Treffer.",
	done: "Fertig",
	rootLevel: "Alle",
	retry: "Erneut versuchen",
	selectedCount: (count: number): string => `${String(count)} ausgewählt`,
	itemCount: (count: number): string => `${String(count)} ${count === 1 ? "Land" : "Länder"}`,
	open: (label: string): string => `${label} öffnen`,
};

const WORLD: readonly CascaderNode[] = [
	{
		value: "europa",
		label: "Europa",
		count: 2,
		children: [
			{ value: "de", label: "Deutschland" },
			{ value: "at", label: "Österreich" },
		],
	},
	{ value: "ozeanien", label: "Ozeanien", count: 1, children: [{ value: "au", label: "Australien" }] },
];

export function Cascader10Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return <Cascader label="Land" items={WORLD} value={value} onChange={setValue} placeholder="Land wählen" labels={GERMAN} />;
}
