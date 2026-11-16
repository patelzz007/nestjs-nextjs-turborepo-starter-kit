import BriefcaseIcon from "lucide-react-native/icons/briefcase";
import MegaphoneIcon from "lucide-react-native/icons/megaphone";
import { Cascader } from "@workspace/ui-native/components/cascader";
import { IconTile, type IconTileTone } from "@workspace/ui-native/components/icon-tile";
import type { CascaderNode } from "@workspace/ui-native/lib/cascader";
import * as React from "react";
import { Text, View } from "react-native";

interface Account {
	readonly code: string;
	readonly spend: string;
}

const ACCOUNTS: Readonly<Record<string, Account>> = {
	opex: { code: "6000", spend: "$84.2k" },
	"opex.travel": { code: "6100", spend: "$12.4k" },
	"opex.travel.flights": { code: "6110", spend: "$8.1k" },
	"opex.software": { code: "6200", spend: "$21.0k" },
	marketing: { code: "7000", spend: "$40.5k" },
	"marketing.ads": { code: "7100", spend: "$31.9k" },
};

/** Every account in a branch takes the branch's colour. */
function tiled(node: CascaderNode, tone: IconTileTone, icon: typeof BriefcaseIcon): CascaderNode {
	return { ...node, icon: <IconTile icon={icon} tone={tone} size="sm" />, children: node.children?.map((child: CascaderNode): CascaderNode => tiled(child, tone, icon)) };
}

const CHART: readonly CascaderNode[] = [
	tiled(
		{
			value: "opex",
			label: "Operating expenses",
			children: [
				{ value: "opex.travel", label: "Travel", children: [{ value: "opex.travel.flights", label: "Flights" }] },
				{ value: "opex.software", label: "Software" },
			],
		},
		"blue",
		BriefcaseIcon,
	),
	tiled({ value: "marketing", label: "Marketing", children: [{ value: "marketing.ads", label: "Advertising" }] }, "orange", MegaphoneIcon),
];

/** The ledger code and the spend, after the name. */
function CodeAndSpend(node: CascaderNode): React.ReactNode {
	const account = ACCOUNTS[node.value];
	return account === undefined ? null : (
		<View className="items-end">
			<Text className="text-caption font-mono text-muted-foreground">{account.code}</Text>
			<Text className="text-caption font-sans-medium text-foreground tabular-nums">{account.spend}</Text>
		</View>
	);
}

export function Cascader20Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("opex.travel");
	return <Cascader label="Account" items={CHART} value={value} onChange={setValue} selectable="any" renderTrailing={CodeAndSpend} />;
}
