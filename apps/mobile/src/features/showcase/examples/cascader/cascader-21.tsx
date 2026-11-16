import { Cascader } from "@workspace/ui-native/components/cascader";
import type { CascaderNode } from "@workspace/ui-native/lib/cascader";
import * as React from "react";

const STORE: readonly CascaderNode[] = [
	{
		value: "audio",
		label: "Audio",
		children: [
			{ value: "audio.headphones", label: "Headphones" },
			{ value: "audio.speakers", label: "Speakers" },
			{ value: "audio.accessories", label: "Accessories", children: [{ value: "audio.accessories.chargers", label: "Chargers" }] },
		],
	},
	{
		value: "phones",
		label: "Phones",
		children: [
			{ value: "phones.cases", label: "Cases" },
			{ value: "phones.accessories", label: "Accessories", children: [{ value: "phones.accessories.chargers", label: "Chargers" }] },
		],
	},
];

/** The level the sheet opens on: where the preset value lives. */
const OPEN_AT: readonly string[] = ["audio"];

export function Cascader21Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("audio.headphones");
	const [path, setPath] = React.useState<readonly string[]>(OPEN_AT);
	return (
		<Cascader
			label="Category"
			items={STORE}
			value={value}
			onChange={setValue}
			path={path}
			onPathChange={setPath}
			searchScope="global"
			hint="Search “chargers” from inside Audio: both trails show."
		/>
	);
}
