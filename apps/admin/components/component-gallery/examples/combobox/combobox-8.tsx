import { Combobox, ComboboxCollection, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@workspace/ui/components/combobox";
import { Field } from "@workspace/ui/components/field";
import type * as React from "react";

/** How many generated options the large list holds. */
const LARGE_LIST_SIZE = 100;
/** Item labels count from one, not from the zero-based array index. */
const FIRST_ITEM_NUMBER = 1;

const LARGE_LIST_ITEMS: readonly string[] = Array.from({ length: LARGE_LIST_SIZE }, (_: undefined, index: number): string => `Item ${String(index + FIRST_ITEM_NUMBER)}`);

function renderListItem(item: string): React.JSX.Element {
	return (
		<ComboboxItem key={item} value={item}>
			{item}
		</ComboboxItem>
	);
}

export function Combobox8Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<Combobox items={LARGE_LIST_ITEMS}>
				<ComboboxInput placeholder={`Search from ${String(LARGE_LIST_SIZE)} items`} />
				<ComboboxContent>
					<ComboboxEmpty text="No items found." />
					<ComboboxList>
						<ComboboxCollection>{renderListItem}</ComboboxCollection>
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</Field>
	);
}
