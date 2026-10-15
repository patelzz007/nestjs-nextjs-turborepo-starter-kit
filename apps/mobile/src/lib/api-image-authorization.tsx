// ============================================
// api-image-authorization.tsx - Pictures the API serves, requested signed in
// ============================================
// A picture the API serves (a GitHub picture shown only to signed-in readers,
// ADR 052) is a request like any other: it carries the session's access token.
// Its address names no reader and never expires, so a cached answer keeps
// working; only the token ages. The token is read once from the secure store
// and shared by every picture; when one fails to load, the session is renewed
// (any authenticated read does that) and every picture still on the old token
// is asked for again with the new one — once per token, so a picture that is
// simply not there is not retried for ever.

import { buildUrl } from "@workspace/api-client";
import * as React from "react";

import { useReadyRuntime } from "../runtime/runtime-context";
import { useApi } from "./api-context";

/** Where a picture loads from, and the headers to send with it (the shape expo-image takes). */
export interface ImageSource {
	readonly uri: string;
	readonly headers?: Record<string, string>;
}

interface ApiImageAuthorization {
	/** The `Authorization` header pictures are asked for with; `undefined` until the token is read, `null` signed out. */
	readonly authorization: string | null | undefined;
	/** A picture asked for with `failed` did not load: renew the session, unless that already happened since. */
	readonly renew: (failed: string | null) => void;
}

const ApiImageAuthorizationContext = React.createContext<ApiImageAuthorization | null>(null);
ApiImageAuthorizationContext.displayName = "ApiImageAuthorization";

function bearer(token: string | null): string | null {
	return token === null ? null : `Bearer ${token}`;
}

export interface ApiImageAuthorizationProviderProps {
	readonly children: React.ReactNode;
}

export function ApiImageAuthorizationProvider({ children }: ApiImageAuthorizationProviderProps): React.JSX.Element {
	const runtime = useReadyRuntime();
	const api = useApi();
	const [authorization, setAuthorization] = React.useState<string | null | undefined>(undefined);
	const renewing = React.useRef(false);

	React.useEffect((): (() => void) => {
		let current = true;
		void runtime.tokenProvider.getAccessToken().then((token: string | null): void => {
			if (current) {
				setAuthorization(bearer(token));
			}
		});
		return (): void => {
			current = false;
		};
	}, [runtime.tokenProvider]);

	const renew = React.useCallback(
		(failed: string | null): void => {
			if (renewing.current || failed !== authorization) {
				return;
			}
			renewing.current = true;
			// Any authenticated read renews an expired access token; then the pictures are asked for again with the new one.
			void api.auth.me
				.fetchOrThrow(undefined)
				.catch((): void => undefined)
				.then(async (): Promise<void> => {
					setAuthorization(bearer(await runtime.tokenProvider.getAccessToken()));
				})
				.finally((): void => {
					renewing.current = false;
				});
		},
		[api, authorization, runtime.tokenProvider],
	);

	const value = React.useMemo((): ApiImageAuthorization => ({ authorization, renew }), [authorization, renew]);
	return <ApiImageAuthorizationContext.Provider value={value}>{children}</ApiImageAuthorizationContext.Provider>;
}

/** How to load pictures the API serves. */
export interface ApiImageSources {
	/** The picture at `pathAndQuery` of the API's current version (`/github/pictures/…?…`, no version prefix), signed in; `null` until the token is read. */
	readonly sourceFor: (pathAndQuery: string) => ImageSource | null;
	/** A picture from {@link sourceFor} did not load. */
	readonly onFailed: (source: ImageSource) => void;
}

export function useApiImageSources(): ApiImageSources {
	const context = React.useContext(ApiImageAuthorizationContext);
	if (context === null) {
		throw new Error("useApiImageSources must be used inside <ApiImageAuthorizationProvider>.");
	}
	const runtime = useReadyRuntime();
	const { authorization, renew } = context;
	const sourceFor = React.useCallback(
		(pathAndQuery: string): ImageSource | null => {
			if (authorization === undefined) {
				return null;
			}
			const uri = buildUrl(runtime.env.apiBaseUrl, pathAndQuery);
			return authorization === null ? { uri } : { uri, headers: { Authorization: authorization } };
		},
		[authorization, runtime.env.apiBaseUrl],
	);
	const onFailed = React.useCallback(
		(source: ImageSource): void => {
			renew(source.headers?.Authorization ?? null);
		},
		[renew],
	);
	return React.useMemo((): ApiImageSources => ({ sourceFor, onFailed }), [onFailed, sourceFor]);
}
