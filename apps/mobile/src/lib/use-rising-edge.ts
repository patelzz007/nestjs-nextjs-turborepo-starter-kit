// Calls `onRise` each time `condition` turns from false to true — "the app came
// back to the foreground", "the connection came back". Not on mount: a
// condition that starts true has not risen.

import * as React from "react";

export function useRisingEdge(condition: boolean, onRise: () => void): void {
	const previous = React.useRef(condition);

	React.useEffect((): void => {
		if (condition && !previous.current) {
			onRise();
		}
		previous.current = condition;
	}, [condition, onRise]);
}
