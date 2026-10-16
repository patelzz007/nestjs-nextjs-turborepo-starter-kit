"use client";

import { Autocomplete, AutocompleteContent, AutocompleteEmpty, AutocompleteInput, AutocompleteList } from "@workspace/ui/components/autocomplete";
import * as React from "react";

import { filterSampleTags, renderSampleTag, sampleTagText } from "@/components/component-gallery/examples/autocomplete/autocomplete-sample-data";

export function Autocomplete5Example(): React.JSX.Element {
	const [value, setValue] = React.useState<string>("");
	const filteredTags = React.useMemo(() => filterSampleTags(value), [value]);

	return (
		<div className="w-full max-w-xs">
			<Autocomplete value={value} onValueChange={setValue} items={filteredTags} itemToStringValue={sampleTagText}>
				<AutocompleteInput placeholder="e.g. feature" showClear />
				<AutocompleteContent>
					<AutocompleteEmpty>No items found.</AutocompleteEmpty>
					<AutocompleteList>{renderSampleTag}</AutocompleteList>
				</AutocompleteContent>
			</Autocomplete>
		</div>
	);
}
