// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { domAnimation, m } from "framer-motion";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { LazyMotionProvider, loadDomAnimation } from "../lazy-motion";

afterEach(() => {
	cleanup();
});

describe("LazyMotionProvider", () => {
	it("fetches framer-motion's DOM animation features on demand", async () => {
		await expect(loadDomAnimation()).resolves.toBe(domAnimation);
	});

	it("renders its m.* children", () => {
		render(
			<LazyMotionProvider>
				<m.div data-testid="animated" initial={false} animate={{ opacity: 1 }} />
			</LazyMotionProvider>,
		);
		expect(screen.getByTestId("animated")).toBeDefined();
	});
});
