"use client";

import * as React from "react";
import { InfoIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupText, InputGroupTextarea } from "@workspace/ui/components/input-group";

/** The longest description the field accepts. */
const MAX_DESCRIPTION_LENGTH = 140;

export function InputGroup17Example(): React.JSX.Element {
	const [value, setValue] = useState("");
	const handleChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>): void => {
		setValue(event.target.value);
	}, []);

	return (
		<Field className="max-w-xs">
			<InputGroup>
				<InputGroupTextarea placeholder="Description..." value={value} onChange={handleChange} maxLength={MAX_DESCRIPTION_LENGTH} className="min-h-16 pb-12" />
				<InputGroupAddon align="block-end">
					<InputGroupText className="text-xs text-muted-foreground">
						{value.length}/{MAX_DESCRIPTION_LENGTH} characters
					</InputGroupText>
					<InfoIcon className="ml-auto text-muted-foreground" />
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
