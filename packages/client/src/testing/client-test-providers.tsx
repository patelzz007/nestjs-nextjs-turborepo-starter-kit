"use client";

import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import type * as React from "react";

import { StaticFeatureFlagsProvider } from "../lib/contexts/feature-flags/feature-flags-context";
import { UrlStateTestProvider } from "../lib/url-state/url-state-test-provider";

export interface ClientTestProvidersProps {
	readonly children: React.ReactNode;
}

/**
 * Everything an app view needs from the app root, for tests: the UI kit's
 * English labels and the URL-state engine on the jsdom address bar
 * (`UrlStateTestProvider`). Use as a Testing Library wrapper —
 * `render(ui, { wrapper: ClientTestProviders })` — or inside an app's own
 * test providers.
 */
export function ClientTestProviders({ children }: ClientTestProvidersProps): React.JSX.Element {
	return (
		<UiKitTestProviders>
			<UrlStateTestProvider>
				{/* Every flag and config at its code default, as when the API hasn't answered (ADR 087). */}
				<StaticFeatureFlagsProvider bundle={null}>{children}</StaticFeatureFlagsProvider>
			</UrlStateTestProvider>
		</UiKitTestProviders>
	);
}
