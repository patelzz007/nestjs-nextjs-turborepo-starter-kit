import { CodeBlock } from "@workspace/ui-native/components/code-block";
import * as React from "react";
import type { CodeBlockLine } from "@workspace/ui-native/components/code-block";

const NAMES: readonly (readonly [string, "red" | "violet" | "green" | "blue" | "yellow"])[] = [
	["rose", "red"],
	["violet", "violet"],
	["emerald", "green"],
	["sky", "blue"],
	["amber", "yellow"],
];
const CODE = NAMES.map(([name]) => `export const ${name} = "${name}";`).join("\n");
const LINES: readonly CodeBlockLine[] = NAMES.map(([name, role]): CodeBlockLine => [
	{ text: "export const ", role: "keyword" },
	{ text: name, role },
	{ text: " = " },
	{ text: `"${name}"`, role: "string" },
	{ text: ";" },
]);

// A palette shown in the theme's tone colours: each token takes a tone's role (the phone's code colours follow the app theme).
export function CodeBlock19Example(): React.JSX.Element {
	return <CodeBlock code={CODE} lines={LINES} caption="palette.ts" />;
}
