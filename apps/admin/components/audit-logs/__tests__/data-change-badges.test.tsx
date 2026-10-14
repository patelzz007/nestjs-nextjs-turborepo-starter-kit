// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { DataChangeActorKindSchema, DataChangeOperationSchema } from "@workspace/shared";
import { afterEach, describe, expect, it } from "vitest";

import { DATA_CHANGE_ACTOR_KIND_LABELS, DATA_CHANGE_OPERATION_LABELS } from "@/lib/data-table/enum-filter-options";

import { DataChangeActorKindBadge, DataChangeOperationBadge } from "../data-change-badges";

afterEach((): void => {
	cleanup();
});

describe("DataChangeOperationBadge", () => {
	it.each(DataChangeOperationSchema.options)("labels %s", (operation) => {
		render(<DataChangeOperationBadge operation={operation} />);

		expect(screen.getByText(DATA_CHANGE_OPERATION_LABELS[operation])).toBeTruthy();
	});

	it("colours a delete differently from an insert", () => {
		const { container, rerender } = render(<DataChangeOperationBadge operation="INSERT" />);
		const insertClass: string = container.firstElementChild?.className ?? "";

		rerender(<DataChangeOperationBadge operation="DELETE" />);

		expect(container.firstElementChild?.className).not.toBe(insertClass);
	});
});

describe("DataChangeActorKindBadge", () => {
	it.each(DataChangeActorKindSchema.options)("labels %s", (actorKind) => {
		render(<DataChangeActorKindBadge actorKind={actorKind} />);

		expect(screen.getByText(DATA_CHANGE_ACTOR_KIND_LABELS[actorKind])).toBeTruthy();
	});
});
