import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";

import restrictedImports from "../plugin/restricted-imports.js";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester();

const PATHS = [
	{
		paths: [
			{ name: "lodash", message: "Use the native method." },
			{ name: "react-dom", importNames: ["flushSync", "createPortal"], message: "No portals." },
		],
	},
];
const PATTERNS = [
	{
		patterns: [
			{ regex: "^@workspace/[^/]+/src/", message: "Use the public entry point." },
			{ regex: "^Next/", caseSensitive: true, message: "Case-sensitive." },
		],
	},
];

// oxlint's RuleTester counts columns from 0 (ESLint's from 1); the CLI positions match ESLint.
// The messages are ESLint's no-restricted-imports messages, byte for byte.
tester.run("restricted-imports", restrictedImports, {
	valid: [
		{ code: 'import { map } from "lodash-es";', options: PATHS },
		{ code: 'import { render } from "react-dom";', options: PATHS },
		{ code: 'export { render } from "react-dom";', options: PATHS },
		{ code: 'import { Button } from "@workspace/ui/components/button";', options: PATTERNS },
		{ code: 'import Link from "next/link";', options: PATTERNS },
		{ code: 'const lodash = "lodash";', options: PATHS },
	],
	invalid: [
		{ code: 'import { map } from "lodash";', options: PATHS, errors: [{ message: "'lodash' import is restricted from being used. Use the native method." }] },
		{ code: 'import "lodash";', options: PATHS, errors: [{ message: "'lodash' import is restricted from being used. Use the native method." }] },
		{ code: 'export * from "lodash";', options: PATHS, errors: [{ message: "'lodash' import is restricted from being used. Use the native method." }] },
		{ code: 'export { map } from "lodash";', options: PATHS, errors: [{ message: "'lodash' import is restricted from being used. Use the native method." }] },
		{
			code: 'import { flushSync, render } from "react-dom";',
			options: PATHS,
			errors: [{ message: "'flushSync' import from 'react-dom' is restricted. No portals.", column: 9 }],
		},
		{
			code: 'import * as ReactDom from "react-dom";',
			options: PATHS,
			errors: [{ message: "* import is invalid because 'flushSync, createPortal' from 'react-dom' is restricted. No portals.", column: 7 }],
		},
		{
			code: 'import { Button } from "@workspace/ui/src/components/button";',
			options: PATTERNS,
			errors: [{ message: "'@workspace/ui/src/components/button' import is restricted from being used by a pattern. Use the public entry point." }],
		},
		{
			code: 'import { Button } from "@WORKSPACE/ui/src/button";',
			options: PATTERNS,
			errors: [{ message: "'@WORKSPACE/ui/src/button' import is restricted from being used by a pattern. Use the public entry point." }],
		},
		{ code: 'import Link from "Next/link";', options: PATTERNS, errors: [{ message: "'Next/link' import is restricted from being used by a pattern. Case-sensitive." }] },
	],
});
