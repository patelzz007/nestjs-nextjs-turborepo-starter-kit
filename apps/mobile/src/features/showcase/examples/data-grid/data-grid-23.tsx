import { Frame, FrameDescription, FrameFooter, FrameHeader, FramePanel, FrameTitle } from "@workspace/ui-native/components/frame";
import type { DataGridTableLayout } from "@workspace/ui-native/lib/data-grid";
import * as React from "react";

import { CrudGrid, type CrudGridProps } from "./data-grid-crud";

const TITLE = "Team members";
const LAYOUT: DataGridTableLayout = { dense: true, columnsResizable: false };

const frame: CrudGridProps["frame"] = ({ toolbar, grid, pager, count }) => (
	<Frame stacked dense className="w-full">
		<FrameHeader>
			<FrameTitle>{TITLE}</FrameTitle>
			<FrameDescription>{count}</FrameDescription>
		</FrameHeader>
		<FramePanel>{toolbar}</FramePanel>
		<FramePanel className="p-0">{grid}</FramePanel>
		<FrameFooter>{pager}</FrameFooter>
	</Frame>
);

// The same list, dense, in a stacked Frame titled Team members.
export function DataGrid23Example(): React.JSX.Element {
	return <CrudGrid frame={frame} layout={LAYOUT} />;
}
