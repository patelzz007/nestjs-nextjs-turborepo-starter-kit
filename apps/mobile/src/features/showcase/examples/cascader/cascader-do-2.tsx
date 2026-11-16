import { Cascader } from "@workspace/ui-native/components/cascader";
import type { CascaderNode } from "@workspace/ui-native/lib/cascader";
import * as React from "react";

const FILES: readonly CascaderNode[] = [
	{
		value: "app",
		label: "app",
		children: [
			{ value: "app/settings", label: "settings", children: [{ value: "app/settings/page.tsx", label: "page.tsx" }] },
			{ value: "app/page.tsx", label: "page.tsx" },
		],
	},
];

export function CascaderDo2Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("app/settings/page.tsx");
	return <Cascader label="File" items={FILES} value={value} onChange={setValue} />;
}
