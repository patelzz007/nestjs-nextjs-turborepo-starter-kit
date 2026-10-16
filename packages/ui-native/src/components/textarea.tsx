// A multi-line text input (a comment, a review): an `Input` that wraps, starts
// at the top and is taller. The same controlled contract as `Input`:
// value in, onChange(value) / onBlur() / onFocus() out, invalid / disabled /
// loading → state. Inside a `Field` it takes the field's label, hint and state.

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import type { TextInput } from "react-native";

import { cn } from "../lib/cn";
import { Input, type InputProps } from "./input";

/** The box's starting height per size; it grows with its text. */
export const textareaVariants = cva("", {
	variants: {
		size: {
			sm: "min-h-20",
			md: "min-h-28",
			lg: "min-h-40",
		},
	},
	defaultVariants: { size: "md" },
});

export type TextareaSize = NonNullable<VariantProps<typeof textareaVariants>["size"]>;

export type TextareaProps = Omit<InputProps, "multiline" | "secureTextEntry">;

export const Textarea = React.memo(
	React.forwardRef<TextInput, TextareaProps>(function Textarea({ size = "md", className, ...props }, ref): React.JSX.Element {
		return <Input ref={ref} multiline size={size} className={cn(textareaVariants({ size }), className)} {...props} />;
	}),
);
