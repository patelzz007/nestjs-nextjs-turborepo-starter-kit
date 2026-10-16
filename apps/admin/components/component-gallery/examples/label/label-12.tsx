"use client";

import * as React from "react";
import { CheckIcon, PencilIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@workspace/ui/components/button";
import { Field, FieldDescription } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";

export function Label12Example(): React.JSX.Element {
	const [isEditing, setIsEditing] = useState(false);
	const [value, setValue] = useState("My Awesome Project");

	const toggleEditing = useCallback((): void => {
		setIsEditing((editing: boolean): boolean => !editing);
	}, []);
	const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setValue(event.target.value);
	}, []);

	return (
		<Field className="w-full max-w-xs">
			<Label htmlFor="label-inline-edit" className="gap-2">
				Project Name
				<Button size="icon-xs" variant="ghost" aria-label={isEditing ? "Save project name" : "Edit project name"} onClick={toggleEditing}>
					{isEditing ? <CheckIcon className="size-3.5" /> : <PencilIcon className="size-3.5" />}
				</Button>
			</Label>
			{isEditing ? <Input id="label-inline-edit" value={value} onChange={handleChange} /> : <FieldDescription>{value}</FieldDescription>}
		</Field>
	);
}
