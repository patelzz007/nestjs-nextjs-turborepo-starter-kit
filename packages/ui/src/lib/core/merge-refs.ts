import type * as React from "react";

function isRefCallback<T>(ref: React.Ref<T>): ref is React.RefCallback<T> {
	return typeof ref === "function";
}

/** Assign a DOM node to a React ref (callback or object). */
export function assignRef<T extends HTMLElement>(ref: React.Ref<T> | undefined | null, value: T | null): void {
	if (ref === undefined || ref === null) {
		return;
	}

	if (isRefCallback(ref)) {
		ref(value);
		return;
	}

	ref.current = value;
}

/** Merge multiple refs onto one callback suitable for JSX `ref`. */
export function mergeRefs<T extends HTMLElement>(...refs: readonly (React.Ref<T> | undefined | null)[]): React.RefCallback<T> {
	return (node: T | null): void => {
		for (const ref of refs) {
			assignRef(ref, node);
		}
	};
}
