import * as React from "react";
import { Autocomplete, AutocompleteContent, AutocompleteEmpty, AutocompleteInput, AutocompleteList } from "@workspace/ui/components/autocomplete";
import { Field, FieldLabel } from "@workspace/ui/components/field";

import { renderSampleTagText, SAMPLE_TAGS } from "@/components/component-showcase/examples/autocomplete/autocomplete-sample-data";

export function AutocompleteDo2Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="autocomplete-do-2">Tag</FieldLabel>
			<Autocomplete items={SAMPLE_TAGS}>
				<AutocompleteInput id="autocomplete-do-2" placeholder="Search tags" />
				<AutocompleteContent>
					<AutocompleteEmpty>No tags match. Try a shorter word.</AutocompleteEmpty>
					<AutocompleteList>{renderSampleTagText}</AutocompleteList>
				</AutocompleteContent>
			</Autocomplete>
		</Field>
	);
}
