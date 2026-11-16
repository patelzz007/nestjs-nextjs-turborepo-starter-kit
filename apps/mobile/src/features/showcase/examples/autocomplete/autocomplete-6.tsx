import { Autocomplete, type AutocompleteItem } from "@workspace/ui-native/components/autocomplete";
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

export function Autocomplete6Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	return <Autocomplete value={value} onChange={setValue} items={TAGS} showTrigger placeholder="Search tags…" accessibilityLabel="Tag" />;
}
