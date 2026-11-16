import { Badge, type BadgeTone, type BadgeVariant } from "@workspace/ui-native/components/badge";
import { Table, type TableColumn, type TableRow } from "@workspace/ui-native/components/table";
import * as React from "react";
import { Text } from "react-native";

import { PersonCell } from "./table-sample";

/** How an order number reads: its sign, then its digits. */
const ORDER_NUMBER_SIGN = "#";

type Column = "order" | "customer" | "status" | "amount";

interface Order {
	readonly id: string;
	readonly customer: string;
	readonly email: string;
	readonly amount: string;
	readonly status: string;
	readonly tone: BadgeTone;
	readonly variant: BadgeVariant;
}

const ORDERS: readonly Order[] = [
	{ id: "3210", customer: "Olivia Martin", email: "olivia@example.com", amount: "$1,999.00", status: "Paid", tone: "success", variant: "solid" },
	{ id: "3209", customer: "Jackson Lee", email: "jackson@example.com", amount: "$39.00", status: "Pending", tone: "warning", variant: "solid" },
	{ id: "3208", customer: "Isabella Nguyen", email: "isabella@example.com", amount: "$299.00", status: "Paid", tone: "success", variant: "solid" },
	{ id: "3207", customer: "William Kim", email: "will@example.com", amount: "$99.00", status: "Refunded", tone: "destructive", variant: "light" },
	{ id: "3206", customer: "Sofia Davis", email: "sofia@example.com", amount: "$2,500.00", status: "Paid", tone: "success", variant: "solid" },
];

/** "#3210": the order\'s number as the table shows it. */
function orderNumberOf(order: Order): string {
	return `${ORDER_NUMBER_SIGN}${order.id}`;
}

const COLUMNS: readonly TableColumn<Column>[] = [
	{ key: "order", label: "Order" },
	{ key: "customer", label: "Customer", width: "lg" },
	{ key: "status", label: "Status" },
	{ key: "amount", label: "Amount", align: "end" },
];

const ROWS: readonly TableRow<Column>[] = ORDERS.map((order: Order): TableRow<Column> => ({
	key: order.id,
	cells: { order: orderNumberOf(order), customer: order.customer, status: order.status, amount: order.amount },
	content: {
		order: <Text className="text-label font-code text-foreground">{orderNumberOf(order)}</Text>,
		customer: <PersonCell name={order.customer} line={order.email} />,
		status: <Badge label={order.status} tone={order.tone} variant={order.variant} size="sm" />,
	},
}));

export function Table7Example(): React.JSX.Element {
	return <Table caption="Recent orders" columns={COLUMNS} rows={ROWS} scrollable />;
}
