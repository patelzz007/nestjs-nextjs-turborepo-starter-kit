import { Item, ItemContent, ItemDescription, ItemTitle, type ItemVariant } from "@workspace/ui-native/components/item";
import * as React from "react";
import { View } from "react-native";

interface VariantRow {
	readonly variant: ItemVariant;
	readonly title: string;
	readonly description: string;
}

const ROWS: readonly VariantRow[] = [
	{ variant: "default", title: "Default Item", description: "A simple item with title and description." },
	{ variant: "outline", title: "Outline Item", description: "An outlined item with visible border." },
	{ variant: "muted", title: "Muted Item", description: "A muted item with subtle background." },
];

export function Item1Example(): React.JSX.Element {
	return (
		<View className="gap-2">
			{ROWS.map((row: VariantRow): React.JSX.Element => (
				<Item key={row.variant} variant={row.variant}>
					<ItemContent>
						<ItemTitle>{row.title}</ItemTitle>
						<ItemDescription>{row.description}</ItemDescription>
					</ItemContent>
				</Item>
			))}
		</View>
	);
}
