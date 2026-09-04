"use client";

import { useEffect } from "react";

export function ReduxDevToolsGuard() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    const windowWithRedux = window as typeof window & {
      __REDUX_DEVTOOLS_EXTENSION__?: unknown;
      __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: unknown;
    };

    try {
      Object.defineProperty(windowWithRedux, "__REDUX_DEVTOOLS_EXTENSION__", {
        configurable: false,
        enumerable: false,
        get: () => undefined,
        set: () => undefined,
      });

      Object.defineProperty(
        windowWithRedux,
        "__REDUX_DEVTOOLS_EXTENSION_COMPOSE__",
        {
          configurable: false,
          enumerable: false,
          get: () => undefined,
          set: () => undefined,
        },
      );
    } catch {
      // Browser extensions can make these properties non-configurable.
    }
  }, []);

  return null;
}