// Hands the one API client of the app to the screens (smart components only).

import * as React from "react";

import type { MobileApiClient } from "./api";

const ApiClientContext = React.createContext<MobileApiClient | null>(null);
ApiClientContext.displayName = "ApiClientContext";

export interface ApiClientProviderProps {
	readonly client: MobileApiClient;
	readonly children: React.ReactNode;
}

export function ApiClientProvider({ client, children }: ApiClientProviderProps): React.JSX.Element {
	return <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>;
}

/** Thrown when a screen asks for the API client outside the root providers — a wiring bug. */
export class MissingApiClientError extends Error {
	public constructor() {
		super("The API client is missing — render inside ApiClientProvider (src/app/_layout.tsx)");
		this.name = "MissingApiClientError";
	}
}

export function useApiClient(): MobileApiClient {
	const client = React.useContext(ApiClientContext);
	if (client === null) {
		throw new MissingApiClientError();
	}
	return client;
}

/** The typed router with TanStack Query hooks. */
export function useApi(): MobileApiClient["api"] {
	return useApiClient().api;
}
