// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Pagination, PaginationContent, PaginationItem, PaginationLink } from "./pagination";

afterEach((): void => {
	cleanup();
});

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
