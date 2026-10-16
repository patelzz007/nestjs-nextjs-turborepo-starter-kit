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
import { Field } from "@workspace/ui/components/field";
import type * as React from "react";
import { useState } from "react";

const FRAMEWORKS: readonly string[] = ["Next.js", "SvelteKit", "Nuxt.js", "Remix", "Astro"];

/** The frameworks picked when the example first renders. */
const INITIAL_FRAMEWORKS: readonly string[] = ["Next.js"];

function renderFrameworkItem(framework: string): React.JSX.Element {
	return (
		<ComboboxItem key={framework} value={framework}>
			{framework}
		</ComboboxItem>
	);
}

export function Combobox12Example(): React.JSX.Element {
	const anchor = useComboboxAnchor();
	const [frameworks, setFrameworks] = useState<string[]>(() => [...INITIAL_FRAMEWORKS]);

	return (
		<Field className="max-w-xs">
			<Combobox multiple autoHighlight items={FRAMEWORKS} value={frameworks} onValueChange={setFrameworks}>
				<ComboboxChips ref={anchor}>
					{frameworks.map((framework: string): React.JSX.Element => (
						<ComboboxChip key={framework}>{framework}</ComboboxChip>
					))}
					<ComboboxChipsInput placeholder="Select frameworks..." />
				</ComboboxChips>
				<ComboboxContent anchor={anchor}>
					<ComboboxEmpty text="No items found." />
					<ComboboxList>
						<ComboboxCollection>{renderFrameworkItem}</ComboboxCollection>
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</Field>
	);
}
