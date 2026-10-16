import { Combobox, ComboboxCollection, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@workspace/ui/components/combobox";
import { Field } from "@workspace/ui/components/field";
import { InputGroupAddon } from "@workspace/ui/components/input-group";
import { GlobeIcon } from "lucide-react";
import type * as React from "react";

const FRAMEWORKS: readonly string[] = ["Next.js", "SvelteKit", "Nuxt.js", "Remix", "Astro"];

function renderFrameworkItem(framework: string): React.JSX.Element {
	return (
		<ComboboxItem key={framework} value={framework}>
			{framework}
		</ComboboxItem>
	);
}

export function Combobox9Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<Combobox items={FRAMEWORKS}>
				<ComboboxInput placeholder="Select a framework">
					<InputGroupAddon>
						<GlobeIcon className="size-4 text-muted-foreground" />
					</InputGroupAddon>
				</ComboboxInput>
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
