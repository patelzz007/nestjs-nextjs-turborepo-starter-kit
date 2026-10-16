import { cleanup, render } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import {
	CardGridSkeleton,
	ChartSkeleton,
	DetailSkeleton,
	FormSkeleton,
	ListSkeleton,
	PageHeaderSkeleton,
	ProseSkeleton,
	StatCardsSkeleton,
	TableSkeleton,
} from "../skeleton-patterns";

afterEach((): void => {
	cleanup();
});

function countBones(root: ParentNode, selector = '[data-slot="skeleton"]'): number {
	return root.querySelectorAll(selector).length;
}

describe("PageHeaderSkeleton", () => {
	it("draws a title and subtitle, plus one bone per header action", (): void => {
		const { container } = render(<PageHeaderSkeleton actions={2} />);

		expect(countBones(container)).toBe(4);
	});

	it("drops the subtitle on request", (): void => {
		const { container } = render(<PageHeaderSkeleton withDescription={false} />);

		expect(countBones(container)).toBe(1);
	});
});

describe("StatCardsSkeleton", () => {
	it("draws the requested number of KPI cards", (): void => {
		const { container } = render(<StatCardsSkeleton count={3} columns={3} />);

		expect(container.querySelectorAll('[data-slot="card"]').length).toBe(3);
		expect(container.querySelector('[data-slot="stat-cards-skeleton"]')?.className).toContain("xl:grid-cols-3");
	});
});

describe("TableSkeleton", () => {
	it("draws a header row and the requested body rows and columns", (): void => {
		const { container } = render(<TableSkeleton rows={3} columns={4} />);

		expect(container.querySelectorAll("thead th").length).toBe(4);
		expect(container.querySelectorAll("tbody tr").length).toBe(3);
		expect(container.querySelectorAll("tbody tr td").length).toBe(12);
	});

	it("hides the columns past the second on phones", (): void => {
		const { container } = render(<TableSkeleton rows={1} columns={4} />);

		const hiddenOnPhones = container.querySelectorAll("thead th.hidden");
		expect(hiddenOnPhones.length).toBe(2);
	});

	it("leads each row with an avatar when asked", (): void => {
		const { container } = render(<TableSkeleton rows={2} columns={3} withAvatar withToolbar={false} withPagination={false} />);

		expect(container.querySelectorAll("tbody .rounded-full.size-8").length).toBe(2);
	});

	it("adds a description line under the card title when asked", (): void => {
		const plain = render(<TableSkeleton rows={1} columns={1} withToolbar={false} withPagination={false} />);
		const plainCount = plain.container.querySelectorAll('[data-slot="card-header"] [data-slot="skeleton"]').length;
		cleanup();
		const described = render(<TableSkeleton rows={1} columns={1} withToolbar={false} withPagination={false} withDescription />);

		expect(described.container.querySelectorAll('[data-slot="card-header"] [data-slot="skeleton"]').length).toBe(plainCount + 1);
	});

	it("sits bare inside an existing card on the plain surface", (): void => {
		const { container } = render(<TableSkeleton surface="plain" />);

		expect(container.querySelector('[data-slot="table-skeleton"]')?.className).not.toContain("bg-card");
		expect(container.querySelector("table")).not.toBeNull();
	});
});

describe("CardGridSkeleton", () => {
	it("draws one card per item, each with an image area by default", (): void => {
		const { container } = render(<CardGridSkeleton count={4} />);

		expect(container.querySelectorAll('[data-slot="card"]').length).toBe(4);
		expect(container.querySelectorAll(".aspect-\\[16\\/10\\]").length).toBe(4);
	});

	it("drops the image area when the cards have none", (): void => {
		const { container } = render(<CardGridSkeleton count={2} withMedia={false} />);

		expect(container.querySelectorAll(".aspect-\\[16\\/10\\]").length).toBe(0);
	});
});

describe("ListSkeleton", () => {
	it("draws the requested rows", (): void => {
		const { container } = render(<ListSkeleton rows={3} />);

		expect(container.querySelectorAll("li").length).toBe(3);
	});

	it("hides the leading slot when there is none", (): void => {
		const { container } = render(<ListSkeleton rows={1} leading="none" withTrailing={false} surface="plain" />);
		const [leadingSlot] = container.querySelectorAll("li [data-slot='skeleton']");

		expect(leadingSlot?.className).toContain("hidden");
	});
});

describe("FormSkeleton", () => {
	it("draws a label and an input per field, and the action row", (): void => {
		const { container } = render(<FormSkeleton fields={3} surface="plain" />);

		expect(container.querySelectorAll(".h-9.w-full").length).toBe(3);
		expect(container.querySelectorAll(".justify-end [data-slot='skeleton']").length).toBe(2);
	});

	it("matches taller controls with the large input size", (): void => {
		const { container } = render(<FormSkeleton fields={2} inputSize="lg" withActions={false} surface="plain" />);

		expect(container.querySelectorAll(".h-11.w-full").length).toBe(2);
		expect(container.querySelectorAll(".h-9.w-full").length).toBe(0);
	});

	it("lays the fields out in two columns from md up", (): void => {
		const { container } = render(<FormSkeleton columns={2} withActions={false} />);

		expect(container.querySelector(".md\\:grid-cols-2")).not.toBeNull();
		expect(container.querySelector(".justify-end")).toBeNull();
	});
});

describe("DetailSkeleton", () => {
	it("draws a label and a value per pair", (): void => {
		const { container } = render(<DetailSkeleton rows={4} surface="plain" />);

		expect(countBones(container)).toBe(8);
	});
});

describe("ChartSkeleton", () => {
	it("draws a bar silhouette inside a card", (): void => {
		const { container } = render(<ChartSkeleton size="sm" />);

		// The card is the pattern's root, so it carries the pattern's slot and the card surface.
		expect(container.querySelector('[data-slot="chart-skeleton"]')?.className).toContain("bg-card");
		expect(container.querySelector(".h-40")?.children.length).toBeGreaterThan(0);
	});
});

describe("ProseSkeleton", () => {
	it("draws the requested lines and ends on a short one", (): void => {
		const { container } = render(<ProseSkeleton lines={3} />);
		const lines = container.querySelectorAll('[data-slot="skeleton"]');

		expect(lines.length).toBe(3);
		expect(lines.item(lines.length - 1).className).toContain("w-2/5");
	});
});

describe("skeleton patterns forward refs", () => {
	it("forwards each pattern's ref to its root", (): void => {
		const refs = {
			header: React.createRef<HTMLDivElement>(),
			stats: React.createRef<HTMLDivElement>(),
			table: React.createRef<HTMLDivElement>(),
			grid: React.createRef<HTMLDivElement>(),
			list: React.createRef<HTMLDivElement>(),
			form: React.createRef<HTMLDivElement>(),
			detail: React.createRef<HTMLDivElement>(),
			chart: React.createRef<HTMLDivElement>(),
			prose: React.createRef<HTMLDivElement>(),
		};
		render(
			<>
				<PageHeaderSkeleton ref={refs.header} />
				<StatCardsSkeleton ref={refs.stats} />
				<TableSkeleton ref={refs.table} />
				<CardGridSkeleton ref={refs.grid} />
				<ListSkeleton ref={refs.list} />
				<FormSkeleton ref={refs.form} />
				<DetailSkeleton ref={refs.detail} />
				<ChartSkeleton ref={refs.chart} />
				<ProseSkeleton ref={refs.prose} />
			</>,
		);

		expect(refs.header.current?.dataset.slot).toBe("page-header-skeleton");
		expect(refs.stats.current?.dataset.slot).toBe("stat-cards-skeleton");
		expect(refs.table.current?.dataset.slot).toBe("table-skeleton");
		expect(refs.grid.current?.dataset.slot).toBe("card-grid-skeleton");
		expect(refs.list.current?.dataset.slot).toBe("list-skeleton");
		expect(refs.form.current?.dataset.slot).toBe("form-skeleton");
		expect(refs.detail.current?.dataset.slot).toBe("detail-skeleton");
		expect(refs.chart.current?.dataset.slot).toBe("chart-skeleton");
		expect(refs.prose.current?.dataset.slot).toBe("prose-skeleton");
	});
});
