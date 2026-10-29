// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { KanbanSearchResult } from "@workspace/shared";
import { Command, CommandList } from "@workspace/ui/components/command";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import { ArrowRightLeft } from "lucide-react";
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { KanbanPaletteResults } from "../kanban-palette-results";

const RESULT: KanbanSearchResult = {
	id: "0199d0c0-0000-7000-8000-0000000000c1",
	key: "STORY-142",
	type: "STORY",
	title: "Refund a card",
	priority: "HIGH",
	storyPoints: 3,
	assignee: null,
	column: { id: "0199d0c0-0000-7000-8000-0000000000a1", board: "EXECUTION", title: "Review", state: "REVIEW" },
	ancestors: [
		{ id: "e", key: "EPIC-1", type: "EPIC", title: "Payments" },
		{ id: "f", key: "FEATURE-2", type: "FEATURE", title: "Refunds" },
	],
	match: "KEY",
};

/** Base UI measures the command list and scrolls the highlighted item into view — jsdom implements neither. */
class NoopResizeObserver {
	public observe(): void {
		return undefined;
	}
	public unobserve(): void {
		return undefined;
	}
	public disconnect(): void {
		return undefined;
	}
}

beforeAll((): void => {
	vi.stubGlobal("ResizeObserver", NoopResizeObserver);
	Element.prototype.scrollIntoView = (): void => undefined;
});

afterEach(() => {
	cleanup();
});

function inPalette(node: React.ReactNode): React.JSX.Element {
	return (
		<Command shouldFilter={false}>
			<CommandList>{node}</CommandList>
		</Command>
	);
}

describe("KanbanPaletteResults", () => {
	it("lists the actions for the item on screen, then the items found, each with its key, parent chain and status", () => {
		const run = vi.fn();
		const onRunAction = vi.fn((action: { readonly run: () => void }) => {
			action.run();
		});
		const onOpenItem = vi.fn();
		render(
			inPalette(
				<KanbanPaletteResults
					focus={{ heading: "STORY-7", actions: [] }}
					actions={[{ id: "move-to", label: "Move to…", icon: ArrowRightLeft, run }]}
					items={[RESULT]}
					onRunAction={onRunAction}
					onOpenItem={onOpenItem}
				/>,
			),
			{ wrapper: UiKitTestProviders },
		);

		expect(screen.getByText("Actions for STORY-7")).toBeDefined();
		expect(screen.getByText("Items")).toBeDefined();
		expect(screen.getByText("STORY-142")).toBeDefined();
		expect(screen.getByText("EPIC-1 › FEATURE-2")).toBeDefined();
		expect(screen.getByText("Review")).toBeDefined();

		fireEvent.click(screen.getByText("Move to…"));
		expect(run).toHaveBeenCalledTimes(1);
		fireEvent.click(screen.getByText("Refund a card"));
		expect(onOpenItem).toHaveBeenCalledWith(RESULT.id);
	});

	it("renders nothing when there is nothing to offer", () => {
		const { container } = render(inPalette(<KanbanPaletteResults focus={null} actions={[]} items={[]} onRunAction={vi.fn()} onOpenItem={vi.fn()} />), {
			wrapper: UiKitTestProviders,
		});

		expect(container.querySelector('[data-slot="command-group"]')).toBeNull();
	});
});
