"use client";

import { Combobox, ComboboxCollection, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@workspace/ui/components/combobox";
import { Field } from "@workspace/ui/components/field";
import type * as React from "react";
import { useState } from "react";

const FRAMEWORKS: readonly string[] = ["Next.js", "SvelteKit", "Nuxt.js", "Remix", "Astro"];

function renderFrameworkItem(framework: string): React.JSX.Element {
	return (
		<ComboboxItem key={framework} value={framework}>
			{framework}
		</ComboboxItem>
	);
}

/**
 * The open-options toggle shows only while nothing is selected; once a value is
 * picked, the clear button takes its place. (The kit's `ComboboxTrigger` draws
 * its own chevron, so the reui example's swapped-in up/down icon is not used.)
 */
export function Combobox18Example(): React.JSX.Element {
	const [value, setValue] = useState<string | null>(null);

	return (
		<Field className="max-w-xs">
			<Combobox value={value} onValueChange={setValue} items={FRAMEWORKS}>
				<ComboboxInput placeholder="Select framework" showTrigger={value === null} showClear />
				<ComboboxContent>
					<ComboboxEmpty text="No items found." />
					<ComboboxList>
						<ComboboxCollection>{renderFrameworkItem}</ComboboxCollection>
					</ComboboxList>
				</ComboboxContent>
			</Combobox>
		</Field>
	);
}
