import * as React from "react";
import { Autocomplete, AutocompleteContent, AutocompleteInput, AutocompleteList } from "@workspace/ui/components/autocomplete";
import { Field, FieldLabel } from "@workspace/ui/components/field";

import { renderSampleTagText, SAMPLE_TAGS } from "@/components/component-showcase/examples/autocomplete/autocomplete-sample-data";

export function AutocompleteDont2Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="autocomplete-dont-2">Tag</FieldLabel>
			<Autocomplete items={SAMPLE_TAGS}>
				<AutocompleteInput id="autocomplete-dont-2" placeholder="Search tags" />
				<AutocompleteContent>
					<AutocompleteList>{renderSampleTagText}</AutocompleteList>
				</AutocompleteContent>
			</Autocomplete>
		</Field>
	);
}
