import { Card } from "@workspace/ui-native/components/card";
import { NumberField } from "@workspace/ui-native/components/number-field";
import { Table, type TableColumn, type TableRow } from "@workspace/ui-native/components/table";
import * as React from "react";

type Column = "item" | "quantity" | "price";

interface LineItem {
	readonly id: string;
	readonly name: string;
	readonly price: string;
}

const ITEMS: readonly LineItem[] = [
	{ id: "1", name: "Item Alpha", price: "$10.00" },
	{ id: "2", name: "Item Beta", price: "$20.00" },
	{ id: "3", name: "Item Gamma", price: "$30.00" },
];

const STARTING: Readonly<Record<string, number>> = { "1": 1, "2": 2, "3": 1 };

const COLUMNS: readonly TableColumn<Column>[] = [
	{ key: "item", label: "Item" },
	{ key: "quantity", label: "Quantity", width: "lg" },
	{ key: "price", label: "Price", align: "end" },
];

function QuantityCell({
	item,
	value,
	onChange,
}: {
	readonly item: LineItem;
	readonly value: number | null;
	readonly onChange: (id: string, value: number | null) => void;
}): React.JSX.Element {
	const change = React.useCallback(
		(next: number | null): void => {
			onChange(item.id, next);
		},
		[item.id, onChange],
	);
	return <NumberField value={value} onChange={change} min={0} size="sm" accessibilityLabel={`Quantity of ${item.name}`} />;
}

// A quantity changed in place: the row is interactive, so each stepper stays reachable.
export function Table5Example(): React.JSX.Element {
	const [quantities, setQuantities] = React.useState<Readonly<Record<string, number | null>>>(STARTING);
	const change = React.useCallback((id: string, value: number | null): void => {
		setQuantities((current: Readonly<Record<string, number | null>>): Readonly<Record<string, number | null>> => ({ ...current, [id]: value }));
	}, []);
	const rows = ITEMS.map((item: LineItem): TableRow<Column> => ({
		key: item.id,
		cells: { item: item.name, quantity: String(quantities[item.id] ?? 0), price: item.price },
		interactive: true,
		content: { quantity: <QuantityCell item={item} value={quantities[item.id] ?? null} onChange={change} /> },
	}));
	return (
		<Card className="p-2">
			<Table caption="Line items" columns={COLUMNS} rows={rows} variant="plain" />
		</Card>
	);
}
