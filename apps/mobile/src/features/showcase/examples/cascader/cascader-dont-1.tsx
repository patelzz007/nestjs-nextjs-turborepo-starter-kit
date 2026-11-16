import { Cascader } from "@workspace/ui-native/components/cascader";
import type { CascaderNode } from "@workspace/ui-native/lib/cascader";
import * as React from "react";

const SIZES: readonly CascaderNode[] = [
	{ value: "s", label: "Small" },
	{ value: "m", label: "Medium" },
	{ value: "l", label: "Large" },
];

export function CascaderDont1Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>(null);
	return <Cascader label="Size" items={SIZES} value={value} onChange={setValue} placeholder="Pick a size" />;
}
