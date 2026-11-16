import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui-native/components/card";
import * as React from "react";

import { CrudGrid, type CrudGridProps } from "./data-grid-crud";

const TITLE = "Members";

const frame: CrudGridProps["frame"] = ({ toolbar, grid, pager, count }) => (
	<Card className="w-full">
		<CardHeader className="gap-3">
			<CardTitle>{TITLE}</CardTitle>
			<CardDescription>{count}</CardDescription>
			{toolbar}
		</CardHeader>
		<CardContent className="px-0">{grid}</CardContent>
		<CardFooter>{pager}</CardFooter>
	</Card>
);

// A member admin list: search, a status filter with counts, row checkboxes and a menu on each row.
export function DataGrid22Example(): React.JSX.Element {
	return <CrudGrid frame={frame} />;
}
