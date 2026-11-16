import { useTable, type CellContext, type ColumnDef, type ExpandedState, type PaginationState } from "@tanstack/react-table";
import { Badge } from "@workspace/ui-native/components/badge";
import { DataGrid, DataGridContainer, DataGridTable } from "@workspace/ui-native/components/data-grid";
import { DataGridPagination, DataGridRowExpand } from "@workspace/ui-native/components/data-grid-parts";
import { dataGridFeatures, type DataGridFeatures } from "@workspace/ui-native/lib/data-grid";
import * as React from "react";
import { Text, View } from "react-native";

import { ORG_TREE, treeChildren, type TreeNode } from "./data-grid-sample-records";

const WIDTH = { name: 240, kind: 120, role: 150 } satisfies Record<string, number>;
const PAGE_SIZE = 4;
const PAGE_SIZES: readonly number[] = [4, 8, 16];
/** Points of indent per level of the tree. */
const INDENT = 16;
const KIND_LABELS: Readonly<Record<TreeNode["kind"], string>> = { department: "Department", team: "Team", member: "Member" };

function NameCell({ row }: CellContext<DataGridFeatures, TreeNode>): React.JSX.Element {
	const style = React.useMemo(() => ({ paddingLeft: row.depth * INDENT }), [row.depth]);
	return (
		<View style={style} className="flex-row items-center gap-1.5">
			{row.getCanExpand() ? <DataGridRowExpand row={row} /> : <View className="size-6" />}
			<Text numberOfLines={1} className={row.original.kind === "member" ? "text-label font-sans text-foreground" : "text-label font-sans-semibold text-foreground"}>
				{row.original.name}
			</Text>
		</View>
	);
}

const COLUMNS: ColumnDef<DataGridFeatures, TreeNode>[] = [
	{ accessorKey: "name", header: "Name", cell: NameCell, size: WIDTH.name },
	{ accessorKey: "kind", header: "Type", cell: ({ row }) => <Badge label={KIND_LABELS[row.original.kind]} variant="outline" size="sm" />, size: WIDTH.kind },
	{ id: "role", accessorFn: (node: TreeNode): string => node.role ?? "", header: "Role", size: WIDTH.role },
];

// Departments open into teams and teams into members; each page counts the departments only.
export function DataGrid30Example(): React.JSX.Element {
	const [expanded, setExpanded] = React.useState<ExpandedState>({});
	const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });
	const table = useTable({
		features: dataGridFeatures,
		columns: COLUMNS,
		data: ORG_TREE,
		getRowId: (node: TreeNode): string => node.id,
		getSubRows: treeChildren,
		paginateExpandedRows: false,
		state: { expanded, pagination },
		onExpandedChange: setExpanded,
		onPaginationChange: setPagination,
	});
	return (
		<DataGrid table={table} recordCount={ORG_TREE.length}>
			<View className="w-full gap-2.5">
				<DataGridContainer>
					<DataGridTable />
				</DataGridContainer>
				<DataGridPagination sizes={PAGE_SIZES} />
			</View>
		</DataGrid>
	);
}
