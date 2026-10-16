"use client";

import { Autocomplete, AutocompleteContent, AutocompleteEmpty, AutocompleteInput, AutocompleteList } from "@workspace/ui/components/autocomplete";
import { Label } from "@workspace/ui/components/label";
import * as React from "react";

import { renderSampleTagText, SAMPLE_TAGS } from "@/components/component-gallery/examples/autocomplete/autocomplete-sample-data";

export function Autocomplete4Example(): React.JSX.Element {
	const inputId = React.useId();
	return (
		<div className="w-full max-w-xs">
			<Autocomplete items={SAMPLE_TAGS} autoHighlight>
				<div className="flex flex-col items-start gap-2">
					<Label htmlFor={inputId}>Label</Label>
					<AutocompleteInput id={inputId} placeholder="e.g. feature" />
				</div>
				<AutocompleteContent>
					<AutocompleteEmpty>No items found.</AutocompleteEmpty>
					<AutocompleteList>{renderSampleTagText}</AutocompleteList>
				</AutocompleteContent>
			</Autocomplete>
		</div>
	);
}
