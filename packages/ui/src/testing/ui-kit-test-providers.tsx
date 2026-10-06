"use client";

import { UiKitLanguageProvider } from "@workspace/ui/components/ui-kit-labels-provider";
import type * as React from "react";

export interface UiKitTestProvidersProps {
	readonly children: React.ReactNode;
}

/**
 * Everything a kit component needs from the app root, for tests: the English
 * label pack. Use as a Testing Library wrapper — `render(ui, { wrapper: UiKitTestProviders })`
 * — or inside an app's own test providers.
 */
export function UiKitTestProviders({ children }: UiKitTestProvidersProps): React.JSX.Element {
	return <UiKitLanguageProvider language="en">{children}</UiKitLanguageProvider>;
}
