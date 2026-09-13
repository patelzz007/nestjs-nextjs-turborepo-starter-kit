import type * as React from "react";
import { z } from "zod";

const HTMLElementRefValueSchema = z.union([z.instanceof(HTMLElement), z.null()]);

const RefCallbackSchema = z.function({
	input: [HTMLElementRefValueSchema],
	output: z.void(),
});

const RefObjectSchema = z.object({
	current: HTMLElementRefValueSchema,
});

type ParsedRefCallback = z.output<typeof RefCallbackSchema>;
type ParsedRefObject = z.output<typeof RefObjectSchema>;

function parseRefCallback<T extends HTMLElement>(ref: React.Ref<T>): ParsedRefCallback | null {
	const parsed = RefCallbackSchema.safeParse(ref);
	return parsed.success ? parsed.data : null;
}

function parseRefObject<T extends HTMLElement>(ref: React.Ref<T>): ParsedRefObject | null {
	const parsed = RefObjectSchema.safeParse(ref);
	return parsed.success ? parsed.data : null;
}

/** Assign a DOM node to a React ref (callback or object). */
export function assignRef<T extends HTMLElement>(ref: React.Ref<T> | undefined | null, value: T | null): void {
	if (ref === undefined || ref === null) {
		return;
	}

	const callbackRef = parseRefCallback(ref);
	if (callbackRef !== null) {
		callbackRef(value);
		return;
	}

	const objectRef = parseRefObject(ref);
	if (objectRef !== null) {
		objectRef.current = value;
	}
}

/** Merge multiple refs onto one callback suitable for JSX `ref`. */
export function mergeRefs<T extends HTMLElement>(...refs: readonly (React.Ref<T> | undefined | null)[]): React.RefCallback<T> {
	return (node: T | null): void => {
		for (const ref of refs) {
			assignRef(ref, node);
		}
	};
}
