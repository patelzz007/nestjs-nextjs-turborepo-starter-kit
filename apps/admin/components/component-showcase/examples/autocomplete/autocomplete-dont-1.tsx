import * as React from "react";
import { Autocomplete, AutocompleteContent, AutocompleteEmpty, AutocompleteInput, AutocompleteList } from "@workspace/ui/components/autocomplete";
import { Field, FieldLabel } from "@workspace/ui/components/field";

import { renderSampleTagText, SAMPLE_TAGS } from "@/components/component-showcase/examples/autocomplete/autocomplete-sample-data";

export function AutocompleteDont1Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="autocomplete-dont-1">Plan (only Free, Pro or Team)</FieldLabel>
			<Autocomplete items={SAMPLE_TAGS}>
				<AutocompleteInput id="autocomplete-dont-1" placeholder="Type a plan" />
				<AutocompleteContent>
					<AutocompleteEmpty>No items found.</AutocompleteEmpty>
					<AutocompleteList>{renderSampleTagText}</AutocompleteList>
				</AutocompleteContent>
			</Autocomplete>
		</Field>
	);
}
