import { Cascader } from "@workspace/ui-native/components/cascader";
import type { CascaderNode } from "@workspace/ui-native/lib/cascader";
import * as React from "react";

const PLACES: readonly CascaderNode[] = [
	{
		value: "eu",
		label: "Europe",
		children: [
			{
				value: "fr",
				label: "France",
				children: [
					{ value: "par", label: "Paris" },
					{ value: "lyo", label: "Lyon" },
				],
			},
		],
	},
	{ value: "as", label: "Asia", children: [{ value: "jp", label: "Japan", children: [{ value: "tyo", label: "Tokyo" }] }] },
];

export function CascaderDo1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return <Cascader label="Office" items={PLACES} value={value} onChange={setValue} placeholder="Pick an office" />;
}
