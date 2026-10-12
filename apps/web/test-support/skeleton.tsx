import { screen } from "@testing-library/react";
import { UiPreferencesStoreProvider } from "@workspace/client/lib/features/ui-preferences/facade";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { expect } from "vitest";

import { WEB_UI_PREFERENCES_DEVTOOLS_NAME, WEB_UI_PREFERENCES_STORAGE_KEY } from "@/lib/ui-preferences/store-config";

export interface SkeletonTestProvidersProps {
	readonly children: React.ReactNode;
}

/**
 * What a web loading surface needs from the app root, for tests: the kit's
 * label pack (`SkeletonRegion`'s announcement) and the UI-preferences store
 * (the catalog skeletons read the saved grid/list layout).
 */
export function SkeletonTestProviders({ children }: SkeletonTestProvidersProps): React.JSX.Element {
	return (
		<UiKitTestProviders>
			<UiPreferencesStoreProvider storageKey={WEB_UI_PREFERENCES_STORAGE_KEY} devtoolsName={WEB_UI_PREFERENCES_DEVTOOLS_NAME}>
				{children}
			</UiPreferencesStoreProvider>
		</UiKitTestProviders>
	);
}

/** Asserts the screen holds exactly one busy loading region, announcing `announcement`. */
export function expectSingleLoadingStatus(announcement: string | undefined): void {
	const statuses = screen.getAllByRole("status");
	expect(statuses).toHaveLength(1);
	const [status] = statuses;
	expect(status?.getAttribute("aria-busy")).toBe("true");
	expect(status?.textContent).toBe(announcement);
}

/** How many elements carry `data-slot={slot}` inside `container`. */
export function countSlots(container: HTMLElement, slot: string): number {
	return container.querySelectorAll(`[data-slot="${slot}"]`).length;
}
