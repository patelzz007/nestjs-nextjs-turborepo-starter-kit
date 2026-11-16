import { Table, type TableColumn, type TableRow } from "@workspace/ui-native/components/table";
import { Trace, TraceLine, TraceStep } from "@workspace/ui-native/components/trace";
import CircleDashedIcon from "lucide-react-native/icons/circle-dashed";
import DatabaseIcon from "lucide-react-native/icons/database";
import FlaskConicalIcon from "lucide-react-native/icons/flask-conical";
import * as React from "react";

interface BuiltModel {
	readonly name: string;
	readonly rows: string;
}

const MODELS: readonly BuiltModel[] = [
	{ name: "stg_orders", rows: "1.2M rows" },
	{ name: "stg_customers", rows: "84K rows" },
	{ name: "int_order_items", rows: "3.4M rows" },
	{ name: "fct_revenue", rows: "1.1M rows" },
];

type DuplicateColumn = "orderId" | "copies";

const DUPLICATE_COLUMNS: readonly TableColumn<DuplicateColumn>[] = [
	{ key: "orderId", label: "order_id" },
	{ key: "copies", label: "Copies", align: "end" },
];

const DUPLICATES: readonly TableRow<DuplicateColumn>[] = [
	{ key: "ord_8821340", cells: { orderId: "ord_8821340", copies: "2" } },
	{ key: "ord_8823004", cells: { orderId: "ord_8823004", copies: "3" } },
];

// The skipped model stays listed as pending, so the run shows which report is stale.
export function Trace13Example(): React.JSX.Element {
	return (
		<Trace accessibilityLabel="Pipeline run">
			<TraceStep icon={DatabaseIcon} title={`Built ${String(MODELS.length)} models`} description="1m 24s">
				<Trace>
					{MODELS.map((model: BuiltModel): React.JSX.Element => (
						<TraceLine key={model.name} title={model.name} description={model.rows} />
					))}
				</Trace>
			</TraceStep>
			<TraceStep icon={FlaskConicalIcon} title="Unique test failed on fct_revenue" description={`${String(DUPLICATES.length)} duplicates`} status="error" defaultOpen>
				<Table caption="Duplicate order ids" columns={DUPLICATE_COLUMNS} rows={DUPLICATES} />
			</TraceStep>
			<TraceLine icon={CircleDashedIcon} title="Skipped dim_customer_ltv" description="upstream failed" status="pending" />
		</Trace>
	);
}
