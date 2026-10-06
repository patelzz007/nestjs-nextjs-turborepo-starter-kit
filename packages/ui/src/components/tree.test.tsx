// @vitest-environment jsdom
import { hotkeysCoreFeature, selectionFeature, syncDataLoaderFeature } from "@headless-tree/core";
import { useTree } from "@headless-tree/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Tree, TreeDragLine, TreeItem, TreeItemLabel, type TreeToggleIconType } from "./tree";

afterEach((): void => {
	cleanup();
});

interface Node {
	readonly name: string;
	readonly children: readonly string[];
}

const NODES: ReadonlyMap<string, Node> = new Map<string, Node>([
	["root", { name: "Root", children: ["fruit", "nuts"] }],
	["fruit", { name: "Fruit", children: ["apple"] }],
	["apple", { name: "Apple", children: [] }],
	["nuts", { name: "Nuts", children: [] }],
]);

const MISSING: Node = { name: "", children: [] };
const INITIAL_EXPANDED: readonly string[] = ["fruit"];
const INDENT_PX = 12;

interface FixtureProps {
	readonly toggleIconType?: TreeToggleIconType;
	readonly withDragLine?: boolean;
	readonly treeRef?: React.Ref<HTMLDivElement>;
}

function Fixture({ toggleIconType, withDragLine = false, treeRef }: FixtureProps): React.JSX.Element {
	const [expandedItems, setExpandedItems] = React.useState<string[]>([...INITIAL_EXPANDED]);
	const tree = useTree<Node>({
		rootItemId: "root",
		getItemName: (item) => item.getItemData().name,
		isItemFolder: (item) => item.getItemData().children.length > 0,
		dataLoader: {
			getItem: (itemId) => NODES.get(itemId) ?? MISSING,
			getChildren: (itemId) => [...(NODES.get(itemId)?.children ?? [])],
		},
		state: { expandedItems },
		setExpandedItems,
		features: [syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature],
	});

	return (
		<Tree ref={treeRef} tree={tree} indent={INDENT_PX} toggleIconType={toggleIconType} aria-label="Pantry">
			{tree.getItems().map((item) => (
				<TreeItem key={item.getId()} item={item}>
					<TreeItemLabel />
				</TreeItem>
			))}
			{withDragLine ? <TreeDragLine data-testid="drag-line" /> : null}
		</Tree>
	);
}

describe("Tree", () => {
	it("renders headless-tree's tree role with one item per visible node", (): void => {
		render(<Fixture />);
		expect(screen.getByRole("tree", { name: "Pantry" }).dataset.slot).toBe("tree");
		expect(screen.getAllByRole("treeitem").map((item) => item.textContent)).toEqual(["Fruit", "Apple", "Nuts"]);
	});

	it("indents each item by its level times the indent", (): void => {
		render(<Fixture />);
		const apple = screen.getByRole("treeitem", { name: "Apple" });
		expect(apple.style.paddingInlineStart).toBe(`${String(INDENT_PX)}px`);
		expect(screen.getByRole("treeitem", { name: "Fruit" }).style.paddingInlineStart).toBe("0px");
	});

	it("marks folders and their expansion for styling and assistive technology", (): void => {
		render(<Fixture />);
		const fruit = screen.getByRole("treeitem", { name: "Fruit" });
		expect(fruit.dataset.folder).toBe("");
		expect(fruit.getAttribute("aria-expanded")).toBe("true");
		expect(screen.getByRole("treeitem", { name: "Apple" }).dataset.folder).toBeUndefined();
	});

	it("collapses a folder through headless-tree's click handling", (): void => {
		render(<Fixture />);
		fireEvent.click(screen.getByRole("treeitem", { name: "Fruit" }));
		expect(screen.queryByRole("treeitem", { name: "Apple" })).toBeNull();
	});

	it("draws a toggle icon for folders only, in the chosen style", (): void => {
		render(<Fixture toggleIconType="plus-minus" />);
		const fruit = screen.getByRole("treeitem", { name: "Fruit" });
		expect(fruit.querySelector("svg.lucide-minus")).toBeTruthy();
		expect(screen.getByRole("treeitem", { name: "Apple" }).querySelector("svg")).toBeNull();
	});

	it("renders no drag line when the drag-and-drop feature is not loaded", (): void => {
		render(<Fixture withDragLine />);
		expect(screen.queryByTestId("drag-line")).toBeNull();
	});

	it("forwards its ref to the container", (): void => {
		const ref = React.createRef<HTMLDivElement>();
		render(<Fixture treeRef={ref} />);
		expect(ref.current?.getAttribute("role")).toBe("tree");
	});
});

describe("TreeItemLabel", () => {
	it("throws outside a TreeItem when given no item", (): void => {
		expect(() => render(<TreeLabelOutsideItem />)).toThrow("TreeItemLabel must be used within a TreeItem or be given an item");
	});
});

function TreeLabelOutsideItem(): React.JSX.Element {
	const tree = useTree<Node>({
		rootItemId: "root",
		getItemName: (item) => item.getItemData().name,
		isItemFolder: (item) => item.getItemData().children.length > 0,
		dataLoader: {
			getItem: (itemId) => NODES.get(itemId) ?? MISSING,
			getChildren: (itemId) => [...(NODES.get(itemId)?.children ?? [])],
		},
		features: [syncDataLoaderFeature],
	});
	return (
		<Tree tree={tree}>
			<TreeItemLabel />
		</Tree>
	);
}
