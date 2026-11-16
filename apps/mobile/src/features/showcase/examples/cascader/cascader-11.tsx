import ServerIcon from "lucide-react-native/icons/server";
import { Cascader } from "@workspace/ui-native/components/cascader";
import { IconTile } from "@workspace/ui-native/components/icon-tile";
import type { CascaderNode } from "@workspace/ui-native/lib/cascader";
import * as React from "react";

const TILE = <IconTile icon={ServerIcon} tone="blue" size="sm" />;

const LOCATIONS: readonly CascaderNode[] = [
	{
		value: "us",
		label: "United States",
		description: "3 cities · 9 zones",
		icon: TILE,
		children: [
			{ value: "us-iad", label: "Ashburn", description: "us-east-1", icon: TILE },
			{ value: "us-sfo", label: "San Francisco", description: "us-west-1", icon: TILE },
		],
	},
	{
		value: "de",
		label: "Germany",
		description: "1 city · 3 zones",
		icon: TILE,
		children: [{ value: "de-fra", label: "Frankfurt", description: "eu-central-1", icon: TILE }],
	},
	{
		value: "cn",
		label: "China",
		description: "Not available on your plan",
		icon: TILE,
		disabled: true,
		children: [{ value: "cn-sha", label: "Shanghai", description: "cn-east-1" }],
	},
];

export function Cascader11Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("de-fra");
	return <Cascader label="Data center" items={LOCATIONS} value={value} onChange={setValue} display="leaf" />;
}
