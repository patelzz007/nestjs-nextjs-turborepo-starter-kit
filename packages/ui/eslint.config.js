import { clientOnlyWidgetsConfig } from "@workspace/eslint-config/client-only-widgets";
import { config } from "@workspace/eslint-config/react-internal";

import { CLIENT_ONLY_WIDGETS } from "./src/lib/client-only-widgets.ts";

/** @type {import("eslint").Linter.Config} */
export default [
	...config,
	// `next/dynamic(..., { ssr: false })` only for the allowlisted browser-only widgets (decision #58).
	clientOnlyWidgetsConfig(CLIENT_ONLY_WIDGETS),
];
