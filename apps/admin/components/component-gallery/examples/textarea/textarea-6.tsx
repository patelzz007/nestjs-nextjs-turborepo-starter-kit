"use client";

import * as React from "react";
import { useCallback, useRef, useState } from "react";

import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Textarea } from "@workspace/ui/components/textarea";

const MAX_CHARS = 280;
/** The counter turns to a warning once this few characters remain. */
const NEAR_LIMIT_REMAINING = 20;

export function Textarea6Example(): React.JSX.Element {
	const [value, setValue] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const newValue = e.target.value;
		if (newValue.length <= MAX_CHARS) {
			setValue(newValue);
		}

		const textarea = textareaRef.current;
		if (textarea) {
			textarea.style.height = "auto";
			textarea.style.height = `${String(textarea.scrollHeight)}px`;
		}
	}, []);

	const remaining = MAX_CHARS - value.length;
	const isNearLimit = remaining <= NEAR_LIMIT_REMAINING;
	const isAtLimit = remaining === 0;

	return (
		<div className="mx-auto w-full max-w-xs">
			<Field className="w-full">
				<div className="flex items-center justify-between">
					<FieldLabel htmlFor="auto-resize-textarea">Bio</FieldLabel>
					<span className={`text-xs tabular-nums ${isAtLimit ? "font-semibold text-destructive" : isNearLimit ? "text-warning" : "text-muted-foreground"}`}>
						{value.length}/{MAX_CHARS}
					</span>
				</div>
				<Textarea
					ref={textareaRef}
					id="auto-resize-textarea"
					value={value}
					onChange={handleChange}
					placeholder="Tell us about yourself..."
					rows={2}
					className="resize-none overflow-hidden"
				/>
			</Field>
		</div>
	);
}
