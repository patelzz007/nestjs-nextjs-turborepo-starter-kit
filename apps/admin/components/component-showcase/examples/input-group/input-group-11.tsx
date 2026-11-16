"use client";

import * as React from "react";
import { useCallback } from "react";
import { CopyIcon } from "lucide-react";

import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";
import { toastMessage } from "@workspace/ui/components/toast";

export function InputGroup11Example(): React.JSX.Element {
	const handleCopy = useCallback((): void => {
		toastMessage.success({ title: "Copied to clipboard" });
	}, []);

	return (
		<Field className="w-full max-w-xs">
			<InputGroup>
				<InputGroupInput defaultValue="https://example.com/share" readOnly />
				<InputGroupAddon align="inline-end">
					<InputGroupButton variant="ghost" size="icon-xs" onClick={handleCopy}>
						<CopyIcon className="size-4" />
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
