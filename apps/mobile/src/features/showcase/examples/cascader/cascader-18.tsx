import { Cascader } from "@workspace/ui-native/components/cascader";
import type { CascaderNode } from "@workspace/ui-native/lib/cascader";
import * as React from "react";
import { Text } from "react-native";

const ZONES: readonly CascaderNode[] = [
	{
		value: "europe",
		label: "Europe",
		children: [
			{
				value: "western",
				label: "Western Europe",
				children: [
					{ value: "fr", label: "France" },
					{ value: "be", label: "Belgium" },
					{ value: "nl", label: "Netherlands" },
				],
			},
			{
				value: "nordics",
				label: "Nordics",
				children: [
					{ value: "se", label: "Sweden" },
					{ value: "no", label: "Norway" },
				],
			},
		],
	},
	{
		value: "americas",
		label: "Americas",
		children: [
			{
				value: "north",
				label: "North America",
				children: [
					{ value: "us", label: "United States" },
					{ value: "ca", label: "Canada" },
				],
			},
		],
	},
];
const INITIAL: readonly string[] = ["se", "no", "us"];

/** The top picks' regions, then how many countries in all. */
function ZoneSummary(paths: readonly (readonly CascaderNode[])[]): React.JSX.Element {
	const regions = [...new Set(paths.map((path: readonly CascaderNode[]): string => path.at(1)?.label ?? ""))];
	return <Text numberOfLines={1} className="text-body-lg font-sans text-foreground">{`${regions.join(", ")} · ${String(paths.length)} countries`}</Text>;
}

export function Cascader18Example(): React.JSX.Element {
	const [values, setValues] = React.useState<readonly string[]>(INITIAL);
	return <Cascader label="Shipping zones" items={ZONES} multiple cascade mode="tree" value={values} onChange={setValues} renderValue={ZoneSummary} placeholder="Pick zones" />;
}
