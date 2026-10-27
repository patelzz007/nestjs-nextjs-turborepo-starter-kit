// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { UI_KIT_LABELS_EN } from "@workspace/ui/lib/labels/en";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { defineUrlState, optionalUrlParam } from "../../lib/url-state/url-state";
import { useUrlState } from "../../lib/url-state/use-url-state";
import { ClientTestProviders } from "../client-test-providers";
import { flushUrlUpdates } from "../flush-url-updates";

const PAGE_URL_STATE = defineUrlState({ view: optionalUrlParam(z.enum(["list", "grid"])) });

beforeEach((): void => {
	window.history.replaceState(null, "", "/rewards");
});

afterEach((): void => {
	cleanup();
	vi.useRealTimers();
});

function updateView(): void {
	const { result } = renderHook(() => useUrlState(PAGE_URL_STATE), { wrapper: ClientTestProviders });
	act((): void => {
		result.current[LIST_SLOT_INDEX.second]({ view: "grid" });
	});
}

describe("flushUrlUpdates", () => {
	it("lets the queued URL write land", async () => {
		updateView();
		expect(window.location.search).toBe("");
		await flushUrlUpdates();
		expect(window.location.search).toBe("?view=grid");
	});

	it("lets it land under fake timers too", async () => {
		vi.useFakeTimers();
		updateView();
		await flushUrlUpdates();
		expect(window.location.search).toBe("?view=grid");
	});
});

function ToggleLabel(): React.JSX.Element {
	return <span>{useUiKitLabels("shellThemeToggle").toggle}</span>;
}

describe("ClientTestProviders", () => {
	it("provides the UI kit's English labels", () => {
		render(<ToggleLabel />, { wrapper: ClientTestProviders });
		expect(screen.getByText(UI_KIT_LABELS_EN.shellThemeToggle.toggle)).toBeDefined();
	});
});
