// One server's history and spec (ADR 068) — pushed from Servers with `?serverId=`.

import * as React from "react";

import { ServerDetailScreen } from "../../../contexts/operations";

export default function ServerRoute(): React.JSX.Element {
	return <ServerDetailScreen />;
}
