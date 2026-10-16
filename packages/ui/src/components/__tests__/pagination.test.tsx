// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { UI_KIT_LABELS_EN } from "../lib/labels/en";
import type { UiKitLabels } from "../lib/labels/ui-kit-labels";
import { UiKitTestProviders } from "../testing/ui-kit-test-providers";
import { UiKitLabelsProvider } from "./ui-kit-labels-provider";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "./pagination";

afterEach((): void => {
	cleanup();
});

/** A label set whose `pagination` family differs from English — proves the provider supplies the copy. */
const GERMAN_LABELS: UiKitLabels = { ...UI_KIT_LABELS_EN, pagination: { ariaLabel: "Seitennummerierung" } };

describe("PaginationLink", () => {
	it("is a real link — announced as a link, not a button — and marks the current page", () => {
		render(
			<Pagination>
				<PaginationContent>
					<PaginationItem>
						<PaginationLink href="?page=1">1</PaginationLink>
					</PaginationItem>
					<PaginationItem>
						<PaginationLink href="?page=2" isActive>
							2
						</PaginationLink>
					</PaginationItem>
				</PaginationContent>
			</Pagination>,
			{ wrapper: UiKitTestProviders },
		);

		const links = screen.getAllByRole("link");
		expect(links.map((link) => link.getAttribute("href"))).toEqual(["?page=1", "?page=2"]);
		expect(screen.queryAllByRole("button")).toHaveLength(0);
		expect(screen.getByRole("link", { name: "2" }).getAttribute("aria-current")).toBe("page");
		expect(screen.getByRole("link", { name: "1" }).hasAttribute("aria-current")).toBe(false);
	});

	it("forwards its ref to the anchor", () => {
		const ref = React.createRef<HTMLAnchorElement>();
		render(
			<PaginationLink ref={ref} href="?page=3">
				3
			</PaginationLink>,
		);

		expect(ref.current?.tagName).toBe("A");
	});
});

describe("Pagination", () => {
	it("names its landmark from the pagination family, and lets aria-label override it", () => {
		const { rerender } = render(<Pagination />, { wrapper: UiKitTestProviders });
		expect(screen.getByRole("navigation", { name: UI_KIT_LABELS_EN.pagination.ariaLabel })).toBeTruthy();

		rerender(<Pagination aria-label="Pages de résultats" />);
		expect(screen.getByRole("navigation", { name: "Pages de résultats" })).toBeTruthy();
	});

	it("forwards refs on previous, next and the ellipsis", () => {
		const previousRef = React.createRef<HTMLAnchorElement>();
		const nextRef = React.createRef<HTMLAnchorElement>();
		const ellipsisRef = React.createRef<HTMLSpanElement>();
		render(
			<>
				<PaginationPrevious ref={previousRef} href="?page=1" text="Previous" labels={{ previousAria: "Go to previous page" }} />
				<PaginationEllipsis ref={ellipsisRef} morePagesLabel="More pages" />
				<PaginationNext ref={nextRef} href="?page=3" text="Next" labels={{ nextAria: "Go to next page" }} />
			</>,
		);

		expect(previousRef.current?.getAttribute("aria-label")).toBe("Go to previous page");
		expect(nextRef.current?.getAttribute("aria-label")).toBe("Go to next page");
		expect(ellipsisRef.current?.dataset.slot).toBe("pagination-ellipsis");
	});

	it("reads the pagination family from the nearest UiKitLabelsProvider", () => {
		render(
			<UiKitLabelsProvider labels={GERMAN_LABELS}>
				<Pagination />
			</UiKitLabelsProvider>,
		);
		expect(screen.getByRole("navigation", { name: GERMAN_LABELS.pagination.ariaLabel })).toBeTruthy();
	});

	it("throws without a UiKitLabelsProvider", () => {
		expect(() => render(<Pagination />)).toThrow('"pagination" labels');
	});
});
