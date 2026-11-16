import * as React from "react";
import { GuidelineTree, type GuidelineTreeRow } from "@/components/component-showcase/examples/tree/tree-guideline-sample";

const ROWS: Readonly<Record<string, GuidelineTreeRow>> = {
	root: { name: "Item", children: ["a"] },
	a: { name: "Item", children: ["b"] },
	b: { name: "Item", children: ["c"] },
	c: { name: "Item", children: ["d"] },
	d: { name: "Item", children: ["e"] },
	e: { name: "Item" },
};

export function TreeDont1Example(): React.JSX.Element {
	return <GuidelineTree rows={ROWS} rootId="root" label="Items" />;
}
