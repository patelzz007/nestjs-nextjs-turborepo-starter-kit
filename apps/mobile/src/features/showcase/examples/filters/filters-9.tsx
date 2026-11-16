import { filterValueItems, type FilterOperator } from "@workspace/ui-kit-logic";
import { InputOTP } from "@workspace/ui-native/components/input-otp";
import { Textarea } from "@workspace/ui-native/components/textarea";
import type { FilterBarEditorProps, FilterBarField } from "@workspace/ui-native/lib/filters";
import * as React from "react";

import { FilterBar, scalarText } from "./filters-sample";

const CODE_LENGTH = 6;
const ANY_OF: readonly FilterOperator[] = [{ value: "is_any_of", label: "is any of", arity: "many" }];
const IS: readonly FilterOperator[] = [{ value: "is", label: "is" }];
const ENDS_WITH: readonly FilterOperator[] = [{ value: "ends_with", label: "ends with" }];
const DOMAIN = /^@?[a-z0-9-]+(?:\.[a-z0-9-]+)+$/u;

/** One keyword a line: pasting a column from a spreadsheet just works. */
function KeywordEditor({ field, value, onValueChange }: FilterBarEditorProps): React.JSX.Element {
	const text = filterValueItems(value).map(scalarText).join("\n");
	const change = React.useCallback(
		(next: string): void => {
			const lines = next.split("\n").map((line: string): string => line.trim());
			onValueChange(lines.some((line: string): boolean => line !== "") ? lines : undefined);
		},
		[onValueChange],
	);
	return <Textarea value={text} onChange={change} accessibilityLabel={field.label} placeholder="One per line" />;
}

/** A six-character order code, a box a character. */
function CodeEditor({ field, value, onValueChange }: FilterBarEditorProps): React.JSX.Element {
	const [item] = filterValueItems(value);
	const upper = React.useCallback((next: string): string => next.toUpperCase(), []);
	return <InputOTP value={scalarText(item)} onChange={onValueChange} normalize={upper} length={CODE_LENGTH} keyboardType="default" accessibilityLabel={field.label} />;
}

/** A domain, or a message saying why not. */
export function validateDomain(value: FilterBarEditorProps["value"]): string | null {
	const [item] = filterValueItems(value);
	const text = scalarText(item);
	return text === "" || DOMAIN.test(text.toLowerCase()) ? null : "Enter a domain, like example.com";
}

const FIELDS: readonly FilterBarField[] = [
	{ id: "weight", label: "Weight", type: "number", unit: " kg" },
	{ id: "keywords", label: "Keywords", operators: ANY_OF, editor: KeywordEditor },
	{ id: "order", label: "Order code", operators: IS, editor: CodeEditor },
	{ id: "email", label: "Email domain", type: "text", operators: ENDS_WITH, validate: validateDomain, placeholder: "example.com" },
];

// Inputs shaped to their value: a unit, a keyword list, a code in boxes, and a domain checked before it is applied.
export function Filters9Example(): React.JSX.Element {
	return <FilterBar fields={FIELDS} showQuery />;
}
