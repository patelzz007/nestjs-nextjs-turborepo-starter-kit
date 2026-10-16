// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Kbd, KbdGroup } from "./kbd";

afterEach(() => {
	cleanup();
});

describe("Kbd", () => {
	it("renders a key as a <kbd>, forwarding its ref and merging its class", () => {
		const ref = React.createRef<HTMLElement>();
		render(
			<Kbd ref={ref} className="extra">
				Esc
			</Kbd>,
		);
		const key = screen.getByText("Esc");
		expect(key.tagName).toBe("KBD");
		expect(key.dataset.slot).toBe("kbd");
		expect(key.className).toContain("extra");
		expect(ref.current).toBe(key);
	});
});

describe("KbdGroup", () => {
	it("marks up a chord as a <kbd> of <kbd>s, forwarding its ref", () => {
		const ref = React.createRef<HTMLElement>();
		const { container } = render(
			<KbdGroup ref={ref}>
				<Kbd>⌘</Kbd>
				<Kbd>K</Kbd>
			</KbdGroup>,
		);
		const group = container.querySelector('[data-slot="kbd-group"]');
		expect(group?.tagName).toBe("KBD");
		expect(group?.querySelectorAll('[data-slot="kbd"]')).toHaveLength(2);
		expect(ref.current).toBe(group);
	});

	it("is phrasing content, so it sits inside a sentence", () => {
		const { container } = render(
			<p>
				Press{" "}
				<KbdGroup>
					<Kbd>⌘</Kbd>
					<Kbd>K</Kbd>
				</KbdGroup>{" "}
				to search.
			</p>,
		);
		// A <div> here would be invalid HTML; the browser would hoist it out of the paragraph.
		expect(container.querySelector("p > kbd[data-slot=kbd-group]")).not.toBeNull();
	});
});
