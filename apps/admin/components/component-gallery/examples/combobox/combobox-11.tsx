"use client";

import { isStringPrimitive } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Combobox, ComboboxCollection, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@workspace/ui/components/combobox";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { toastMessage } from "@workspace/ui/components/toast";
import type * as React from "react";
import { useCallback } from "react";

const FRAMEWORKS: readonly string[] = ["Next.js", "SvelteKit", "Nuxt.js", "Remix", "Astro"];

const FORM_ID = "form-with-combobox";
const FRAMEWORK_FIELD = "framework";

function renderFrameworkItem(framework: string): React.JSX.Element {
	return (
		<ComboboxItem key={framework} value={framework}>
			{framework}
		</ComboboxItem>
	);
}

export function Combobox11Example(): React.JSX.Element {
	const handleSubmit = useCallback((event: React.SubmitEvent<HTMLFormElement>): void => {
		event.preventDefault();
		const framework = new FormData(event.currentTarget).get(FRAMEWORK_FIELD);
		if (isStringPrimitive(framework)) {
			toastMessage.success({ title: `You selected ${framework} as your framework.` });
		}
	}, []);

	return (
		<form id={FORM_ID} onSubmit={handleSubmit} className="w-full max-w-xs space-y-4">
			<Field>
				<FieldLabel htmlFor={FRAMEWORK_FIELD}>Framework</FieldLabel>
				<Combobox items={FRAMEWORKS}>
					<ComboboxInput id={FRAMEWORK_FIELD} name={FRAMEWORK_FIELD} placeholder="Select a framework" required />
					<ComboboxContent>
						<ComboboxEmpty text="No items found." />
						<ComboboxList>
							<ComboboxCollection>{renderFrameworkItem}</ComboboxCollection>
						</ComboboxList>
					</ComboboxContent>
				</Combobox>
			</Field>
			<Button type="submit" form={FORM_ID} className="w-full">
				Submit
			</Button>
		</form>
	);
}
