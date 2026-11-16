"use client";

import { Button } from "@workspace/ui/components/button";
import { Combobox, ComboboxCollection, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@workspace/ui/components/combobox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog";
import { Field, FieldLabel } from "@workspace/ui/components/field";
import { toastMessage } from "@workspace/ui/components/toast";
import type * as React from "react";
import { useCallback, useState } from "react";

const FRAMEWORKS: readonly string[] = ["Next.js", "SvelteKit", "Nuxt.js", "Remix", "Astro"];

const INPUT_ID = "framework-dialog";

const DIALOG_TRIGGER_BUTTON = <Button className="w-full max-w-xs" />;

function renderFrameworkItem(framework: string): React.JSX.Element {
	return (
		<ComboboxItem key={framework} value={framework}>
			{framework}
		</ComboboxItem>
	);
}

export function Combobox17Example(): React.JSX.Element {
	const [open, setOpen] = useState(false);

	const handleCancel = useCallback((): void => {
		setOpen(false);
	}, []);

	const handleConfirm = useCallback((): void => {
		toastMessage.success({ title: "Framework selected." });
		setOpen(false);
	}, []);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={DIALOG_TRIGGER_BUTTON}>Open Dialog</DialogTrigger>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle>Select Framework</DialogTitle>
					<DialogDescription>Choose your preferred framework from the list below.</DialogDescription>
				</DialogHeader>
				<Field className="pt-4">
					<FieldLabel htmlFor={INPUT_ID} className="sr-only">
						Framework
					</FieldLabel>
					<Combobox items={FRAMEWORKS}>
						<ComboboxInput id={INPUT_ID} placeholder="Select a framework" />
						<ComboboxContent>
							<ComboboxEmpty text="No items found." />
							<ComboboxList>
								<ComboboxCollection>{renderFrameworkItem}</ComboboxCollection>
							</ComboboxList>
						</ComboboxContent>
					</Combobox>
				</Field>
				<DialogFooter className="pt-4">
					<Button type="button" variant="outline" onClick={handleCancel}>
						Cancel
					</Button>
					<Button type="button" onClick={handleConfirm}>
						Confirm
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
