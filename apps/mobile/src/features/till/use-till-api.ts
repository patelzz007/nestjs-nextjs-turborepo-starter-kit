// The till's API calls (pair, validate, checkout), bound to a context that
// carries the terminal's credentials instead of the signed-in person's session
// (@workspace/api-client `createPosCaller`; ADR 017). `null` credentials: before
// pairing — only `pairTerminal` may be called.

import { createPosCaller, type PosCaller, type PosTerminalCredentials } from "@workspace/api-client";
import * as React from "react";

import { useApiClient } from "../../lib/api-context";

export function useTillApi(credentials: PosTerminalCredentials | null): PosCaller {
	const { context } = useApiClient();
	return React.useMemo((): PosCaller => createPosCaller(context, credentials), [context, credentials]);
}
