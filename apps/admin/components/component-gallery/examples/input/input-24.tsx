"use client";

import * as React from "react";
import { useCallback, useState } from "react";

import { Field, FieldLabel } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";

export function Input24Example(): React.JSX.Element {
	const [isFocused, setIsFocused] = useState(false);
	const handleBlur = useCallback((): void => {
		setIsFocused(false);
	}, []);
	const handleFocus = useCallback((): void => {
		setIsFocused(true);
	}, []);

	return (
		<Field className="max-w-xs">
			<FieldLabel htmlFor="pulsed-input">Pulsed Background</FieldLabel>
			<div className="relative">
				<div className={`pointer-events-none absolute inset-0 rounded-md bg-primary/20 transition-opacity duration-300 ${isFocused ? "opacity-0" : "animate-pulse"}`} />
				<Input
					id="pulsed-input"
					placeholder="Animation stops on focus..."
					onFocus={handleFocus}
					onBlur={handleBlur}
					className="relative bg-transparent shadow-none transition-colors duration-300 focus-visible:bg-background"
				/>
			</div>
		</Field>
	);
}
