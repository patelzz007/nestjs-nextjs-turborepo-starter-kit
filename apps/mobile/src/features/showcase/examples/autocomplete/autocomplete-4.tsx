import { Autocomplete, type AutocompleteItem } from "@workspace/ui-native/components/autocomplete";
import { Field } from "@workspace/ui-native/components/field";
import * as React from "react";

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

export function Autocomplete4Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return (
		<Field label="Component">
			<Autocomplete value={value} onChange={setValue} items={TAGS} autoHighlight />
		</Field>
	);
}
