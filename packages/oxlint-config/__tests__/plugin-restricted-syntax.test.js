import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";

import restrictedSyntax from "../plugin/restricted-syntax.js";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester();

tester.run("restricted-syntax", restrictedSyntax, {
	valid: [
		{ code: "const value = 1;", options: [{ selector: "WithStatement", message: "No with." }] },
		{ code: "const items = [first];", options: ["MemberExpression[computed=true] > Literal"] },
	],
	invalid: [
		{ code: "debugger;", options: [{ selector: "DebuggerStatement", message: "No debugger." }], errors: [{ message: "No debugger." }] },
		{ code: "debugger;", options: ["DebuggerStatement"], errors: [{ message: "Using 'DebuggerStatement' is not allowed." }] },
		{ code: "debugger;", options: [{ selector: "DebuggerStatement" }], errors: [{ message: "Using 'DebuggerStatement' is not allowed." }] },
		{
			// Two options on the same selector both report (the visitors chain instead of overwriting).
			code: "const first = items[0];",
			options: [
				{ selector: "MemberExpression[computed=true] > Literal[raw=/^\\d+$/]", message: "No numeric index." },
				{ selector: "MemberExpression[computed=true] > Literal[raw=/^\\d+$/]", message: "Still no numeric index." },
			],
			errors: [{ message: "No numeric index." }, { message: "Still no numeric index." }],
		},
		{
			code: "export type Bag = Record<string, unknown>;",
			filename: "fixture.ts",
			options: [{ selector: "TSUnknownKeyword", message: "No unknown." }],
			errors: [{ message: "No unknown." }],
		},
	],
});
