"use client";

import * as React from "react";
import { useCallback, useState } from "react";

import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

/** The longest description the field accepts. */
const maxLength = 50;

export function Input6Example(): React.JSX.Element {
	const [value, setValue] = useState("");

	const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setValue(event.target.value);
	}, []);

	return (
		<Field className="max-w-xs">
			<div className="flex items-center justify-between">
				<FieldLabel htmlFor="bio">Description</FieldLabel>
				<span className="text-xs text-muted-foreground">
					{String(value.length)}/{String(maxLength)}
				</span>
			</div>
			<Input id="bio" maxLength={maxLength} value={value} onChange={handleChange} placeholder="Description of your project" />
		</Field>
	);
}
