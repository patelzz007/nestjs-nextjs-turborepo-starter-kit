import type * as React from "react";
import { z } from "zod";

const refCallbackSchema = z.custom<React.RefCallback<HTMLElement>>((value) => typeof value === "function");

const refObjectSchema = z.custom<React.RefObject<HTMLElement>>((value) => typeof value === "object" && value !== null && "current" in value);

/** Assign a DOM node to a React ref (callback or object). */
export function assignRef<T extends HTMLElement>(ref: React.Ref<T> | undefined | null, value: T | null): void {
	if (ref === undefined || ref === null) {
		return;
	}

	const callbackParsed = refCallbackSchema.safeParse(ref);
	if (callbackParsed.success) {
		callbackParsed.data(value);
		return;
	}

	const objectParsed = refObjectSchema.safeParse(ref);
	if (objectParsed.success) {
		objectParsed.data.current = value;
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
