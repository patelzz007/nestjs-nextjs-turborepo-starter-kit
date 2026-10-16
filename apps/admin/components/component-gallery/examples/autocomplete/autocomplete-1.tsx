"use client";

import { Autocomplete, AutocompleteContent, AutocompleteEmpty, AutocompleteInput, AutocompleteList } from "@workspace/ui/components/autocomplete";
import type * as React from "react";

import { renderSampleTagText, SAMPLE_TAGS } from "@/components/component-gallery/examples/autocomplete/autocomplete-sample-data";

export function Autocomplete1Example(): React.JSX.Element {
	return (
		<div className="w-full max-w-xs">
			<Autocomplete items={SAMPLE_TAGS}>
				<AutocompleteInput placeholder="Search items" />
				<AutocompleteContent>
					<AutocompleteEmpty>No items found.</AutocompleteEmpty>
					<AutocompleteList>{renderSampleTagText}</AutocompleteList>
				</AutocompleteContent>
			</Autocomplete>
		</div>
	);
}
