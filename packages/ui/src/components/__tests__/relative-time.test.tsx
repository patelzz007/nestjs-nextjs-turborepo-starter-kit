// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import type { DisplayRegion } from "@workspace/shared";
import * as React from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RELATIVE_TIME_REFRESH_INTERVAL_MS, RelativeTime } from "./relative-time";

const KUALA_LUMPUR: DisplayRegion = { locale: "en-MY", timeZone: "Asia/Kuala_Lumpur" };
const MINUTE_MS = 60_000;
/** 15 Nov 2026 12:00 UTC (8:00 pm in Kuala Lumpur). */
const SEEN_AT = Date.UTC(2026, 10, 15, 12);
const ABSOLUTE_LABEL = "15 Nov 2026, 8:00 pm";

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
	vi.setSystemTime(SEEN_AT + 5 * MINUTE_MS);
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe("RelativeTime", () => {
	it("renders the absolute time on the server — there is no trustworthy 'now' there", () => {
		const html = renderToString(<RelativeTime epochMs={SEEN_AT} region={KUALA_LUMPUR} />);

		expect(html).toContain(ABSOLUTE_LABEL);
		expect(html).not.toContain("ago");
		expect(html).toContain('dateTime="2026-11-15T12:00:00.000Z"');
	});

	it("hydrates the server HTML without a mismatch, then switches to the relative wording", () => {
		// The server renders a minute before the browser hydrates — their clocks never agree.
		vi.setSystemTime(SEEN_AT + 4 * MINUTE_MS);
		const container = document.createElement("div");
		container.innerHTML = renderToString(<RelativeTime epochMs={SEEN_AT} region={KUALA_LUMPUR} />);
		document.body.append(container);
		vi.setSystemTime(SEEN_AT + 5 * MINUTE_MS);
		const onRecoverableError = vi.fn();

		let root: Root | undefined;
		act(() => {
			root = hydrateRoot(container, <RelativeTime epochMs={SEEN_AT} region={KUALA_LUMPUR} />, { onRecoverableError });
		});

		expect(onRecoverableError).not.toHaveBeenCalled();
		expect(container.textContent).toBe("5 minutes ago");
		expect(container.querySelector("time")?.getAttribute("title")).toBe(ABSOLUTE_LABEL);
		act(() => {
			root?.unmount();
		});
		container.remove();
	});

	it("keeps the wording current while mounted", () => {
		render(<RelativeTime epochMs={SEEN_AT} region={KUALA_LUMPUR} />);
		expect(screen.getByText("5 minutes ago")).toBeDefined();

		act(() => {
			vi.setSystemTime(SEEN_AT + 6 * MINUTE_MS);
			vi.advanceTimersByTime(RELATIVE_TIME_REFRESH_INTERVAL_MS);
		});

		expect(screen.getByText("6 minutes ago")).toBeDefined();
	});

	it("forwards its ref to the <time> element", () => {
		const ref = React.createRef<HTMLTimeElement>();
		render(<RelativeTime ref={ref} epochMs={SEEN_AT} region={KUALA_LUMPUR} />);

		expect(ref.current?.tagName).toBe("TIME");
	});
});
