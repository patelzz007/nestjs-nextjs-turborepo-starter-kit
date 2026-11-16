import * as React from "react";
import { Autocomplete, AutocompleteContent, AutocompleteEmpty, AutocompleteInput, AutocompleteList } from "@workspace/ui/components/autocomplete";
import { Field, FieldDescription, FieldLabel } from "@workspace/ui/components/field";

import { renderSampleTagText, SAMPLE_TAGS } from "@/components/component-showcase/examples/autocomplete/autocomplete-sample-data";

export function AutocompleteDo1Example(): React.JSX.Element {
	return (
		<Field className="w-full max-w-xs">
			<FieldLabel htmlFor="autocomplete-do-1">Tag</FieldLabel>
			<Autocomplete items={SAMPLE_TAGS}>
				<AutocompleteInput id="autocomplete-do-1" placeholder="Type a tag" aria-describedby="autocomplete-do-1-hint" />
				<AutocompleteContent>
					<AutocompleteEmpty>A new tag: press Enter to add it.</AutocompleteEmpty>
					<AutocompleteList>{renderSampleTagText}</AutocompleteList>
				</AutocompleteContent>
			</Autocomplete>
			<FieldDescription id="autocomplete-do-1-hint">Pick a suggestion or add your own.</FieldDescription>
		</Field>
	);
}
