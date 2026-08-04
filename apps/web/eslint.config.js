import { nextJsConfig } from "@workspace/eslint-config/next-js";

/** @type {import("eslint").Linter.Config} */
export default [
	...nextJsConfig,
	{
		// proxy.test.ts exercises the proxy with structural test doubles for
		// NextRequest/NextResponse. The type-assertion ban is a false positive
		// for test mocks, so it is scoped to the test file only.
		files: ["proxy.test.ts"],
		rules: {
			"@typescript-eslint/consistent-type-assertions": "off",
		},
	},
];
