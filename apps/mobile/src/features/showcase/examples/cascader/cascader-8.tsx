import RotateCcwIcon from "lucide-react-native/icons/rotate-ccw";
import { Button } from "@workspace/ui-native/components/button";
import { Cascader } from "@workspace/ui-native/components/cascader";
import { type CascaderFlatRow, cascaderTreeFromRows } from "@workspace/ui-native/lib/cascader";
import * as React from "react";

/** Rows as a database returns them: unsorted, each with its parent's id. */
const ROWS: readonly CascaderFlatRow[] = [
	{ id: "sales-emea", parentId: "emea", label: "Sales" },
	{ id: "apac", parentId: null, label: "Asia Pacific" },
	{ id: "support-apac", parentId: "apac", label: "Support" },
	{ id: "emea", parentId: null, label: "Europe, Middle East & Africa" },
	{ id: "eng-emea", parentId: "emea", label: "Engineering" },
	{ id: "sales-apac", parentId: "apac", label: "Sales" },
	{ id: "amer", parentId: null, label: "Americas" },
	{ id: "sales-amer", parentId: "amer", label: "Sales" },
];

const DEPARTMENTS = cascaderTreeFromRows(ROWS);

export function Cascader8Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string | null>("eng-emea");
	const reset = React.useCallback((): void => {
		setValue(null);
	}, []);
	const footer = <Button label="Reset" icon={RotateCcwIcon} variant="ghost" size="sm" onPress={reset} />;
	return <Cascader label="Department" items={DEPARTMENTS} value={value} onChange={setValue} placeholder="Pick a department" footer={footer} />;
}
