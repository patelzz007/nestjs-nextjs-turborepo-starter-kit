import { Autocomplete, type AutocompleteItem } from "@workspace/ui-native/components/autocomplete";
import { Button } from "@workspace/ui-native/components/button";
import { Field } from "@workspace/ui-native/components/field";
import * as React from "react";
import { View } from "react-native";

import { ignorePress } from "../example-support";

/** Component and tag names to suggest. */
const TAGS: readonly AutocompleteItem[] = [
	"Accordion",
	"Alert",
	"Avatar",
	"Badge",
	"Breadcrumb",
	"Button",
	"Calendar",
	"Card",
	"Carousel",
	"Chart",
	"Checkbox",
	"Combobox",
	"Dialog",
	"Drawer",
	"Field",
	"Input",
	"Menu",
	"Popover",
	"Select",
	"Slider",
	"Switch",
	"Table",
	"Tabs",
	"Toast",
	"Tooltip",
].map((name: string): AutocompleteItem => ({ value: name }));

export function Autocomplete12Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	const error = value.length > 0 && !TAGS.some((tag: AutocompleteItem): boolean => tag.value === value) ? "Pick a component from the list." : undefined;
	return (
		<View className="gap-3">
			<Field label="Component" error={error}>
				<Autocomplete value={value} onChange={setValue} items={TAGS} autoHighlight />
			</Field>
			<Button label="Add" disabled={error !== undefined} onPress={ignorePress} />
		</View>
	);
}
