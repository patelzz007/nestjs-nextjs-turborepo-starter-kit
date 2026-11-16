"use client";

import * as React from "react";
import { useCallback } from "react";
import { CopyIcon, StarIcon } from "lucide-react";

import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";
import { toastMessage } from "@workspace/ui/components/toast";

export function InputGroup21Example(): React.JSX.Element {
	const handleCopy = useCallback((): void => {
		toastMessage.success({ title: "Copied to clipboard" });
	}, []);

	return (
		<Field className="max-w-xs">
			<InputGroup>
				<InputGroupInput placeholder="Component name..." />
				<InputGroupAddon align="inline-end">
					<StarIcon className="size-4 text-muted-foreground" />
					<InputGroupButton size="icon-xs" variant="ghost" onClick={handleCopy}>
						<CopyIcon className="size-4" />
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
