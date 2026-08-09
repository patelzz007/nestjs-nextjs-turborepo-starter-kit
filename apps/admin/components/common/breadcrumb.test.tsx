// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";

import {
	Breadcrumb,
	BreadcrumbEllipsis,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@workspace/ui/components/navigation/breadcrumb";

afterEach(() => {
	cleanup();
});

describe("Breadcrumb primitives", () => {
	it("renders the nav with an overridable aria-label (improvement 7)", () => {
		render(
			<Breadcrumb ariaLabel="You are here">
				<BreadcrumbList />
			</Breadcrumb>,
		);
		expect(screen.getByLabelText("You are here")).toBeTruthy();
		expect(screen.queryByLabelText("breadcrumb")).toBeNull();
	});

	it("defaults the aria-label to breadcrumb", () => {
		render(
			<Breadcrumb>
				<BreadcrumbList />
			</Breadcrumb>,
		);
		expect(screen.getByLabelText("breadcrumb")).toBeTruthy();
	});

	it("applies the scrollable single-line and sm size variants on the list (improvements 3/8)", () => {
		const { container } = render(
			<BreadcrumbList size="sm" scrollable>
				<BreadcrumbItem>x</BreadcrumbItem>
			</BreadcrumbList>,
		);
		const list = container.querySelector("[data-slot=breadcrumb-list]");
		expect(list?.className).toContain("overflow-x-auto");
		expect(list?.className).toContain("flex-nowrap");
		expect(list?.className).toContain("text-xs");
	});

	it("defaults the list to a wrapping default-size list", () => {
		const { container } = render(
			<BreadcrumbList>
				<BreadcrumbItem>x</BreadcrumbItem>
			</BreadcrumbList>,
		);
		const list = container.querySelector("[data-slot=breadcrumb-list]");
		expect(list?.className).toContain("flex-wrap");
		expect(list?.className).toContain("text-sm");
	});

	it("forwards refs on the link (rule 20)", () => {
		const ref = createRef<HTMLAnchorElement>();
		render(<BreadcrumbLink ref={ref} href="/x" />);
		expect(ref.current).not.toBeNull();
		expect(ref.current?.tagName).toBe("A");
	});

	it("renders the current page as a non-focusable span with aria-current (improvement 2)", () => {
		render(<BreadcrumbPage>General</BreadcrumbPage>);
		const page = screen.getByText("General").closest("[data-slot=breadcrumb-page]");
		expect(page?.getAttribute("aria-current")).toBe("page");
		// NOT focusable: no tabindex, no role="link".
		expect(page?.hasAttribute("tabindex")).toBe(false);
		expect(page?.getAttribute("role")).toBeNull();
		expect(page?.tagName).toBe("SPAN");
	});

	it("renders a default chevron separator and accepts custom children (improvement 6)", () => {
		const { container } = render(<BreadcrumbSeparator />);
		expect(container.querySelector("[data-slot=breadcrumb-separator] svg")).toBeTruthy();

		cleanup();
		render(<BreadcrumbSeparator>{">"}</BreadcrumbSeparator>);
		expect(screen.getByText(">")).toBeTruthy();
	});

	it("renders an sr-only label on the ellipsis that can be localized (improvement 12)", () => {
		const { container } = render(<BreadcrumbEllipsis label="Show more" />);
		expect(screen.getByText("Show more")).toBeTruthy();
		expect(container.querySelector("[data-slot=breadcrumb-ellipsis]")).toBeTruthy();
	});
});
