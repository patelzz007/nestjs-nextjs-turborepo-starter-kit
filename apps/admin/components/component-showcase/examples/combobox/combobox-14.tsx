"use client";

import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxCollection,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxItem,
	ComboboxList,
	useComboboxAnchor,
} from "@workspace/ui/components/combobox";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import type * as React from "react";
import { useState } from "react";

const FRAMEWORKS: readonly string[] = ["Next.js", "SvelteKit", "Nuxt.js", "Remix", "Astro"];

/** The frameworks picked when the example first renders. */
const INITIAL_FRAMEWORKS: readonly string[] = ["Next.js", "SvelteKit"];

const INPUT_ID = "combobox-multiple-invalid";

const REQUIRED_ERRORS: { message: string }[] = [{ message: "This field is required." }];

function renderFrameworkItem(framework: string): React.JSX.Element {
	return (
		<ComboboxItem key={framework} value={framework}>
			{framework}
		</ComboboxItem>
	);
}

export function Combobox14Example(): React.JSX.Element {
	const anchor = useComboboxAnchor();
	const [frameworks, setFrameworks] = useState<string[]>(() => [...INITIAL_FRAMEWORKS]);

	return (
		<Field className="max-w-xs" data-invalid>
			<FieldLabel htmlFor={INPUT_ID}>Frameworks</FieldLabel>
			<Combobox multiple autoHighlight items={FRAMEWORKS} value={frameworks} onValueChange={setFrameworks} invalid>
				<ComboboxChips ref={anchor}>
					{frameworks.map((framework: string): React.JSX.Element => (
						<ComboboxChip key={framework}>{framework}</ComboboxChip>
					))}
					<ComboboxChipsInput placeholder="Select frameworks..." id={INPUT_ID} />
				</ComboboxChips>
				<ComboboxContent anchor={anchor}>
					<ComboboxEmpty text="No items found." />
					<ComboboxList>
						<ComboboxCollection>{renderFrameworkItem}</ComboboxCollection>
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
			<FieldError errors={REQUIRED_ERRORS} />
		</Field>
	);
}
