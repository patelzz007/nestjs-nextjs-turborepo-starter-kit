import { config } from "@workspace/eslint-config/react-internal";

/** @type {import("eslint").Linter.Config} */
export default [
	...config,
	{
		rules: {
			// Repo rule #2 bans `unknown` everywhere (including catch variables).
			// We type promise rejection handlers as `Error` and normalize non-Error
			// reasons at the boundary (`toError` in `from.ts`), so the eslint
			// default (prefer `: unknown` in `then` rejection callbacks) is
			// deliberately disabled for this package.
			"@typescript-eslint/use-unknown-in-catch-callback-variable": "off",
		},
	},
];
