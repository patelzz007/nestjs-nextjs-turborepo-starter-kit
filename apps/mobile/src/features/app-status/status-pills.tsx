// The connection and session pills: StatusPills fed by the app status. Each
// subscribes to its own slice, so the connection pill does not re-render with
// every countdown tick. `compact` for the screens' corner, full in the drawer.

import * as React from "react";

import { StatusPill } from "../../components/status-pill";
import { useConnectivity, useSessionIndicator } from "./facade";
import { networkPillContent, sessionPillContent } from "./indicators";

export interface AppStatusPillProps {
	readonly compact: boolean;
	readonly testID?: string;
}

export function NetworkStatusPill({ compact, testID }: AppStatusPillProps): React.JSX.Element {
	const content = networkPillContent(useConnectivity(), compact);
	return <StatusPill {...content} {...(testID === undefined ? {} : { testID })} />;
}

export function SessionStatusPill({ compact, testID }: AppStatusPillProps): React.JSX.Element {
	const content = sessionPillContent(useSessionIndicator(), compact);
	return <StatusPill {...content} {...(testID === undefined ? {} : { testID })} />;
}
