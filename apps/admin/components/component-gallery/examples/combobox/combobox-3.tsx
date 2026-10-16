import { Combobox, ComboboxCollection, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@workspace/ui/components/combobox";
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field";
import type * as React from "react";

const FRAMEWORKS: readonly string[] = ["Next.js", "SvelteKit", "Nuxt.js", "Remix", "Astro"];

const INPUT_ID = "combobox-framework-invalid";

const REQUIRED_ERRORS: { message: string }[] = [{ message: "This field is required." }];

function renderFrameworkItem(framework: string): React.JSX.Element {
	return (
		<ComboboxItem key={framework} value={framework}>
			{framework}
		</ComboboxItem>
	);
}

export function Combobox3Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs" data-invalid>
			<FieldLabel htmlFor={INPUT_ID}>Framework</FieldLabel>
			<Combobox items={FRAMEWORKS} invalid>
				<ComboboxInput id={INPUT_ID} placeholder="Select a framework" />
				<ComboboxContent>
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
