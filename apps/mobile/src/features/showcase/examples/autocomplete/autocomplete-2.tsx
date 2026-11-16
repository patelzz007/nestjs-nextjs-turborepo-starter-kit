import { Autocomplete, type AutocompleteItem } from "@workspace/ui-native/components/autocomplete";
import * as React from "react";

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

export function Autocomplete2Example(): React.JSX.Element {
	return <Autocomplete value="" onChange={ignorePress} items={TAGS} disabled placeholder="Search tags…" accessibilityLabel="Tag" />;
}
