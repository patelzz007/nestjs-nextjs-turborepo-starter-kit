// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Scrollspy } from "./scrollspy";

/** Sections sit at these offsets inside the container. */
const SECTION_TOPS: Readonly<Record<string, number>> = { intro: 0, usage: 400, api: 800 };
const CONTAINER_HEIGHT = 300;
const CONTENT_HEIGHT = 2000;
const INITIAL_SYNC_DELAY_MS = 100;

function placeSections(container: HTMLElement): void {
	for (const [id, top] of Object.entries(SECTION_TOPS)) {
		const section = document.getElementById(id);
		if (section !== null) {
			Object.defineProperty(section, "offsetTop", { configurable: true, value: top });
		}
	}
	Object.defineProperty(container, "clientHeight", { configurable: true, value: CONTAINER_HEIGHT });
	Object.defineProperty(container, "scrollHeight", { configurable: true, value: CONTENT_HEIGHT });
}

interface FixtureProps {
	readonly onUpdate?: (id: string) => void;
	readonly history?: boolean;
	readonly spyRef?: React.Ref<HTMLDivElement>;
	readonly throttleTime?: number;
}

function Fixture({ onUpdate, history = false, spyRef, throttleTime }: FixtureProps): React.JSX.Element {
	const targetRef = React.useRef<HTMLDivElement | null>(null);
	return (
		<>
			<Scrollspy ref={spyRef} targetRef={targetRef} onUpdate={onUpdate} history={history} throttleTime={throttleTime} smooth={false} className="flex gap-2">
				<a href="#intro" data-scrollspy-anchor="intro">
					Intro
				</a>
				<a href="#usage" data-scrollspy-anchor="usage">
					Usage
				</a>
				<a href="#api" data-scrollspy-anchor="api" data-scrollspy-offset="50">
					API
				</a>
			</Scrollspy>
			<div ref={targetRef} data-testid="container">
				<section id="intro">Intro section</section>
				<section id="usage">Usage section</section>
				<section id="api">API section</section>
			</div>
		</>
	);
}

beforeEach((): void => {
	vi.useFakeTimers();
	window.history.replaceState({}, "", "/");
});

afterEach((): void => {
	cleanup();
	vi.useRealTimers();
});

function activeAnchors(): string[] {
	return Array.from(document.querySelectorAll<HTMLElement>("[data-active]")).map((anchor) => anchor.textContent);
}

describe("Scrollspy", () => {
	it("scrolls the target to a clicked anchor's section (minus its offset) and marks it active", (): void => {
		const onUpdate = vi.fn();
		render(<Fixture onUpdate={onUpdate} history />);
		const container = screen.getByTestId("container");
		placeSections(container);
		const scrollTo = vi.fn();
		container.scrollTo = scrollTo;

		fireEvent.click(screen.getByText("API"));
		expect(scrollTo).toHaveBeenCalledWith({ top: 750, left: 0, behavior: "auto" });
		expect(onUpdate).toHaveBeenCalledWith("api");
		expect(activeAnchors()).toEqual(["API"]);
		expect(window.location.hash).toBe("#api");
	});

	it("activates the section nearest the top as the target scrolls", (): void => {
		const onUpdate = vi.fn();
		render(<Fixture onUpdate={onUpdate} />);
		const container = screen.getByTestId("container");
		placeSections(container);

		container.scrollTop = 450;
		fireEvent.scroll(container);
		expect(activeAnchors()).toEqual(["Usage"]);

		container.scrollTop = CONTENT_HEIGHT - CONTAINER_HEIGHT;
		fireEvent.scroll(container);
		expect(activeAnchors()).toEqual(["API"]);
		expect(onUpdate).toHaveBeenLastCalledWith("api");
	});

	it("syncs once on mount, scrolling to the section named by the URL hash", (): void => {
		window.history.replaceState({}, "", "/#usage");
		const onUpdate = vi.fn();
		render(<Fixture onUpdate={onUpdate} />);
		const container = screen.getByTestId("container");
		placeSections(container);
		const scrollTo = vi.fn();
		container.scrollTo = scrollTo;

		act((): void => {
			vi.advanceTimersByTime(INITIAL_SYNC_DELAY_MS);
		});
		expect(scrollTo).toHaveBeenCalledWith({ top: 400, left: 0, behavior: "auto" });
		expect(onUpdate).toHaveBeenCalledWith("usage");
	});

	it("throttles scroll updates to one per throttleTime, with a trailing update", (): void => {
		const onUpdate = vi.fn();
		render(<Fixture onUpdate={onUpdate} throttleTime={200} />);
		const container = screen.getByTestId("container");
		placeSections(container);
		act((): void => {
			vi.advanceTimersByTime(INITIAL_SYNC_DELAY_MS);
		});
		onUpdate.mockClear();

		container.scrollTop = 450;
		fireEvent.scroll(container);
		container.scrollTop = 0;
		fireEvent.scroll(container);
		expect(onUpdate).toHaveBeenCalledTimes(1);
		act((): void => {
			vi.advanceTimersByTime(200);
		});
		expect(onUpdate).toHaveBeenCalledTimes(2);
		expect(onUpdate).toHaveBeenLastCalledWith("intro");
	});

	it("removes its click listeners on unmount", (): void => {
		const onUpdate = vi.fn();
		const { unmount } = render(<Fixture onUpdate={onUpdate} />);
		const anchor = screen.getByText("Usage");
		unmount();
		document.body.appendChild(anchor);
		fireEvent.click(anchor);
		expect(onUpdate).not.toHaveBeenCalled();
		anchor.remove();
	});

	it("forwards its ref and passes div props through", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(<Fixture spyRef={ref} />);
		expect(ref.current?.dataset.slot).toBe("scrollspy");
		expect(ref.current?.className).toBe("flex gap-2");
	});
});
