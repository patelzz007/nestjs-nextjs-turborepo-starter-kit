import * as React from "react";
import { Combobox, ComboboxCollection, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@workspace/ui/components/combobox";
import { Field, FieldLabel } from "@workspace/ui/components/field";

const SIZES: readonly string[] = ["Small", "Medium", "Large"];

function renderSize(value: string): React.JSX.Element {
	return (
		<ComboboxItem key={value} value={value}>
			{value}
		</ComboboxItem>
	);
}

export function ComboboxDont1Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="combobox-dont-1">Size</FieldLabel>
			<Combobox items={SIZES}>
				<ComboboxInput id="combobox-dont-1" placeholder="Search" />
				<ComboboxContent>
					<ComboboxEmpty text="No items found." />
					<ComboboxList>
						<ComboboxCollection>{renderSize}</ComboboxCollection>
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</Field>
	);
}
