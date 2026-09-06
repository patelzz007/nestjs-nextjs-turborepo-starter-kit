"use client";

import { useEffect } from "react";

const REDUX_DEVTOOLS_EXTENSION = "__REDUX_DEVTOOLS_EXTENSION__";
const REDUX_DEVTOOLS_EXTENSION_COMPOSE = "__REDUX_DEVTOOLS_EXTENSION_COMPOSE__";

export function ReduxDevToolsGuard(): null {
	useEffect(() => {
		if (process.env.NODE_ENV !== "production") {
			return;
		}

		try {
			Object.defineProperty(window, REDUX_DEVTOOLS_EXTENSION, {
				configurable: false,
				enumerable: false,
				get: (): undefined => undefined,
				set: (): undefined => undefined,
			});

			Object.defineProperty(window, REDUX_DEVTOOLS_EXTENSION_COMPOSE, {
				configurable: false,
				enumerable: false,
				get: (): undefined => undefined,
				set: (): undefined => undefined,
			});
		} catch {
			// Browser extensions can make these properties non-configurable.
		}
	}, []);

	return null;
}
