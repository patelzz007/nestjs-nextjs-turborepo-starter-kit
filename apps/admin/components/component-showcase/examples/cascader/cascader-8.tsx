"use client";

import * as React from "react";
import { RotateCcwIcon } from "lucide-react";
import { useCallback, useState } from "react";
import {
	Cascader,
	CascaderContent,
	CascaderEmpty,
	CascaderList,
	CascaderPanel,
	CascaderStatus,
	CascaderTrigger,
	useCascaderSelection,
} from "@workspace/ui/components/cascader/cascader";
import { CascaderAction, CascaderFooter } from "@workspace/ui/components/cascader/cascader-footer";
import { CascaderItems } from "@workspace/ui/components/cascader/cascader-item";
import { CascaderBreadcrumb, CascaderInput, CascaderNav, CascaderValue } from "@workspace/ui/components/cascader/cascader-nav";
import type { CascaderNode } from "@workspace/ui/components/cascader/cascader-types";

import { Button } from "@workspace/ui/components/button";

const resetIcon = <RotateCcwIcon className="size-4" />;

/**
 * Rows as they come out of a database: no nesting, just a parent pointer.
 * Deliberately unsorted, to show the index does not depend on parents arriving
 * before their children.
 */
interface RowData {
	readonly parentId: string | null;
}

type Row = CascaderNode<RowData>;

const rows: readonly Row[] = [
	{ value: "3", label: "Marketing", data: { parentId: "1" } },
	{ value: "1", label: "North America", data: { parentId: null } },
	{ value: "5", label: "Sales", data: { parentId: "2" } },
	{ value: "2", label: "Europe", data: { parentId: null } },
	{ value: "4", label: "Engineering", data: { parentId: "1" } },
	{ value: "7", label: "Platform", data: { parentId: "4" } },
	{ value: "6", label: "Support", data: { parentId: "2" } },
	{ value: "8", label: "Product", data: { parentId: "4" } },
	{ value: "9", label: "Design", data: { parentId: "2" } },
	{ value: "11", label: "Field Sales", data: { parentId: "10" } },
	{ value: "10", label: "Latin America", data: { parentId: null } },
	{ value: "13", label: "Partnerships", data: { parentId: "12" } },
	{ value: "12", label: "Asia Pacific", data: { parentId: null } },
	{ value: "15", label: "Operations", data: { parentId: "14" } },
	{ value: "14", label: "Middle East", data: { parentId: null } },
	{ value: "16", label: "Africa", data: { parentId: null } },
	{ value: "17", label: "Distribution", data: { parentId: "16" } },
	{ value: "18", label: "Oceania", data: { parentId: null } },
	{ value: "19", label: "Retail", data: { parentId: "18" } },
	{ value: "20", label: "Infrastructure", data: { parentId: "7" } },
	{ value: "21", label: "Developer Tools", data: { parentId: "7" } },
	{ value: "22", label: "Customer Success", data: { parentId: "12" } },
];

/**
 * The reset as a footer COMMAND, reading the selection out of context instead of
 * being handed it. Nothing in here is specific to this example - composed into
 * any panel it clears that cascader - and `isEmpty` is what stops it offering to
 * undo nothing.
 */
/** Reads the parent pointer each flat row carries in its payload. */
function getRowParent(node: Row): string | null {
	return node.data?.parentId ?? null;
}

function ResetAction(): React.JSX.Element {
	const { clear, isEmpty } = useCascaderSelection();

	return (
		<CascaderAction icon={resetIcon} disabled={isEmpty} onSelect={clear}>
			Reset selection
		</CascaderAction>
	);
}

/**
 * Flat adjacency input. Pass the rows as-is plus `getParent`, and the tree is
 * indexed in one linear pass - no client-side re-nesting step, which is what
 * keeps a large normalized dataset cheap to render and cheap to update.
 *
 * The footer carries the same reset command this family uses everywhere else.
 * A drill-down picker has no other way back to "nothing selected" once a
 * department is committed: the trigger shows a value, and re-picking it in a
 * single-select list only reselects it. `CascaderFooter` draws the rule
 * itself, with a `border-t` that sits exactly on the boundary between the list
 * and the footer. An explicit `CascaderSeparator` in here looked equivalent and
 * was not: it stacks its own block margin on top of BOTH containers' padding,
 * which measured 12px above the rule against 6px below, where the panel's own
 * rhythm is 4px after the search field and 0 between rows. The border needs no
 * arithmetic to be symmetric, because it is the boundary rather than a child of
 * one side of it.
 */
export function Cascader8Example(): React.JSX.Element {
	const [value, setValue] = useState("");
	const handleValueChange = useCallback((next: string): void => {
		setValue(next);
	}, []);

	return (
		<div className="flex w-full flex-col items-center gap-3 p-4">
			<Cascader items={rows} getParent={getRowParent} value={value} onValueChange={handleValueChange}>
				<CascaderTrigger aria-label="Department" render={<Button variant="outline" className="w-72 justify-between gap-2 font-normal" />}>
					<CascaderValue placeholder="Select a department" />
				</CascaderTrigger>

				<CascaderContent className="w-72">
					<CascaderPanel>
						<CascaderNav>
							<CascaderInput />
						</CascaderNav>
						<CascaderBreadcrumb />
						<CascaderEmpty />
						<CascaderList>
							<CascaderItems />
						</CascaderList>

						{/* A SIBLING of the list, never a child of it: `CascaderList`'s own
                Enter handler clicks whatever it contains, so a command living
                inside the rows would fire on the keystroke that commits one. */}
						<CascaderFooter>
							<ResetAction />
						</CascaderFooter>

						<CascaderStatus />
					</CascaderPanel>
				</CascaderContent>
			</Cascader>
		</div>
	);
}
