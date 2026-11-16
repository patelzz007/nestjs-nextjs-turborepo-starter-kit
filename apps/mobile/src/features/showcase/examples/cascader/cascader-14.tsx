import FolderIcon from "lucide-react-native/icons/folder";
import { type CascaderChangeDetails, Cascader } from "@workspace/ui-native/components/cascader";
import { Icon } from "@workspace/ui-native/components/icon";
import type { CascaderNode } from "@workspace/ui-native/lib/cascader";
import * as React from "react";

const FOLDER = <Icon icon={FolderIcon} size="sm" colorClassName="accent-muted-foreground" />;

const SPACES: readonly CascaderNode[] = [
	{
		value: "marketing",
		label: "Marketing",
		icon: FOLDER,
		children: [
			{ value: "marketing/campaigns", label: "Campaigns", icon: FOLDER },
			{ value: "marketing/brand", label: "Brand", icon: FOLDER },
		],
	},
	{
		value: "product",
		label: "Product",
		icon: FOLDER,
		children: [{ value: "product/specs", label: "Specs", icon: FOLDER, children: [{ value: "product/specs/2026", label: "2026", icon: FOLDER }] }],
	},
	{ value: "people", label: "People", icon: FOLDER },
];

/** How many recent destinations are offered first. */
const RECENT_COUNT = 2;

/** The tree with the recent destinations first, under their own heading (a copy of each, so the tree keeps its place). */
function withRecent(recent: readonly CascaderNode[]): readonly CascaderNode[] {
	return [
		...recent.map((node: CascaderNode): CascaderNode => ({ value: `recent:${node.value}`, label: node.label, icon: FOLDER, group: "Recently used" })),
		...SPACES.map((node: CascaderNode): CascaderNode => ({ ...node, group: "All spaces" })),
	];
}

export function Cascader14Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	const [recent, setRecent] = React.useState<readonly CascaderNode[]>([]);
	const items = React.useMemo(() => withRecent(recent), [recent]);
	const move = React.useCallback((next: string, details: CascaderChangeDetails): void => {
		const picked = details.node;
		setValue(next);
		if (picked !== null) {
			const clean = { value: picked.value.replace("recent:", ""), label: picked.label };
			setRecent((current: readonly CascaderNode[]): readonly CascaderNode[] =>
				[clean, ...current.filter((node: CascaderNode): boolean => node.value !== clean.value)].slice(0, RECENT_COUNT),
			);
		}
	}, []);
	return <Cascader label="Move to" items={items} value={value} onChange={move} mode="tree" selectable="any" display="leaf" placeholder="Pick a folder" />;
}
