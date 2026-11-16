// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NavigationProgressProvider } from "@workspace/ui/components/navigation-progress";

import { useProgressRouter } from "../use-progress-router";

const push = vi.fn<(href: string) => void>();
const replace = vi.fn<(href: string) => void>();
const back = vi.fn<() => void>();

vi.mock("next/navigation", () => ({
	useRouter: (): { readonly push: typeof push; readonly replace: typeof replace; readonly back: typeof back } => ({ push, replace, back }),
}));

function Navigator(): React.JSX.Element {
	const router = useProgressRouter();
	const pushSettings = React.useCallback((): void => {
		router.push("/settings");
	}, [router]);
	const replaceTab = React.useCallback((): void => {
		router.replace("/settings?tab=security", { scroll: false });
	}, [router]);
	const goBack = React.useCallback((): void => {
		router.back();
	}, [router]);
	return (
		<>
			<button type="button" onClick={pushSettings}>
				Push
			</button>
			<button type="button" onClick={replaceTab}>
				Replace
			</button>
			<button type="button" onClick={goBack}>
				Back
			</button>
		</>
	);
}

function phase(): string | undefined {
	return document.querySelector<HTMLElement>("[data-slot=navigation-progress]")?.getAttribute("data-phase") ?? undefined;
}

// This package's test setup does not unmount between tests.
afterEach((): void => {
	cleanup();
});

describe("useProgressRouter", () => {
	beforeEach((): void => {
		window.history.replaceState(null, "", "/reports");
		push.mockClear();
		replace.mockClear();
		back.mockClear();
	});

	it("starts the progress bar, then pushes with the App Router", (): void => {
		render(
			<NavigationProgressProvider>
				<Navigator />
			</NavigationProgressProvider>,
		);
		fireEvent.click(screen.getByText("Push"));
		expect(phase()).toBe("waiting");
		expect(push).toHaveBeenCalledWith("/settings");
	});

	it("starts the progress bar, then replaces with the App Router's options", (): void => {
		render(
			<NavigationProgressProvider>
				<Navigator />
			</NavigationProgressProvider>,
		);
		fireEvent.click(screen.getByText("Replace"));
		expect(phase()).toBe("waiting");
		expect(replace).toHaveBeenCalledWith("/settings?tab=security", { scroll: false });
	});

	it("passes the rest of the router through untouched", (): void => {
		render(
			<NavigationProgressProvider>
				<Navigator />
			</NavigationProgressProvider>,
		);
		fireEvent.click(screen.getByText("Back"));
		expect(back).toHaveBeenCalledTimes(1);
		expect(phase()).toBe("idle");
	});

	it("still navigates without a progress provider", (): void => {
		render(<Navigator />);
		fireEvent.click(screen.getByText("Push"));
		expect(push).toHaveBeenCalledWith("/settings");
	});
});
