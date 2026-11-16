import FileIcon from "lucide-react-native/icons/file";
import { Cascader } from "@workspace/ui-native/components/cascader";
import { Icon } from "@workspace/ui-native/components/icon";
import type { CascaderNode } from "@workspace/ui-native/lib/cascader";
import * as React from "react";

const FILE = <Icon icon={FileIcon} size="sm" colorClassName="accent-muted-foreground" />;

const SOURCE: readonly CascaderNode[] = [
	{
		value: "app",
		label: "app",
		children: [
			{ value: "app/page.tsx", label: "page.tsx", icon: FILE },
			{ value: "app/layout.tsx", label: "layout.tsx", icon: FILE },
			{
				value: "app/settings",
				label: "settings",
				children: [
					{ value: "app/settings/page.tsx", label: "page.tsx", icon: FILE },
					{ value: "app/settings/billing", label: "billing", children: [{ value: "app/settings/billing/page.tsx", label: "page.tsx", icon: FILE }] },
				],
			},
		],
	},
	{ value: "lib", label: "lib", children: [{ value: "lib/utils.ts", label: "utils.ts", icon: FILE }] },
];

export function Cascader3Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return (
		<Cascader label="File" items={SOURCE} value={value} onChange={setValue} placeholder="Find a file" searchScope="deep" hint="Search “page” to see each match's folder." />
	);
}
