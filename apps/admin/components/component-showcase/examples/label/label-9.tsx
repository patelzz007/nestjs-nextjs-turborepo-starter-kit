"use client";

import * as React from "react";
import { useCallback, useState } from "react";

import { Field } from "@workspace/ui/components/field";
import { Label } from "@workspace/ui/components/label";
import { Textarea } from "@workspace/ui/components/textarea";

const BIO_MAX_LENGTH = 200;

export function Label9Example(): React.JSX.Element {
	const [length, setLength] = useState(0);

	const handleChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>): void => {
		setLength(event.target.value.length);
	}, []);

	return (
		<Field className="w-full max-w-xs">
			<Label htmlFor="label-counter" className="justify-between">
				Bio
				<span className="text-muted-foreground">
					{String(length)}/{String(BIO_MAX_LENGTH)}
				</span>
			</Label>
			<Textarea id="label-counter" placeholder="Tell us about yourself…" maxLength={BIO_MAX_LENGTH} onChange={handleChange} />
		</Field>
	);
}
