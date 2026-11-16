import {
	buildCascaderIndex,
	type CascaderNode,
	cascaderCheckStateOf,
	cascaderPathOf,
	cascaderPathSegments,
	cascaderTreeFromRows,
	foldCascaderText,
	formatCascaderPath,
	isCascaderSelectable,
	searchCascader,
	toggleCascaderCascade,
	toggleCascaderValue,
} from "../cascader";

const TREE: readonly CascaderNode[] = [
	{
		value: "europe",
		label: "Europe",
		children: [
			{
				value: "ch",
				label: "Switzerland",
				children: [
					{ value: "zrh", label: "Zürich" },
					{ value: "gva", label: "Geneva", keywords: ["united nations"] },
				],
			},
			{
				value: "de",
				label: "Germany",
				children: [
					{ value: "ber", label: "Berlin" },
					{ value: "muc", label: "Munich", disabled: true },
				],
			},
		],
	},
	{ value: "asia", label: "Asia", hasChildren: true },
];
const INDEX = buildCascaderIndex(TREE);

describe("buildCascaderIndex", () => {
	it("indexes nested nodes, flat nodes with parent pointers, and loaded children", () => {
		expect(INDEX.roots.map((node) => node.value)).toStrictEqual(["europe", "asia"]);
		expect(cascaderPathOf(INDEX, "zrh").map((node) => node.label)).toStrictEqual(["Europe", "Switzerland", "Zürich"]);
		expect(cascaderPathOf(INDEX, "nowhere")).toStrictEqual([]);
		const flat = buildCascaderIndex(
			[
				{ value: "a", label: "A" },
				{ value: "b", label: "B" },
			],
			{ getParent: (node: CascaderNode): string | null => (node.value === "b" ? "a" : null), loaded: new Map([["b", [{ value: "c", label: "C" }]]]) },
		);
		expect(cascaderPathOf(flat, "c").map((node) => node.value)).toStrictEqual(["a", "b", "c"]);
	});
});

describe("selection", () => {
	it("knows what can be picked, and cascades a branch's ticks to its open leaves", () => {
		const europe = INDEX.byValue.get("europe");
		const asia = INDEX.byValue.get("asia");
		if (europe === undefined || asia === undefined) {
			throw new Error("Fixture missing");
		}
		expect(isCascaderSelectable(INDEX, europe, "leaf")).toBe(false);
		expect(isCascaderSelectable(INDEX, asia, "leaf")).toBe(false);
		expect(isCascaderSelectable(INDEX, europe, "any")).toBe(true);
		expect(isCascaderSelectable(INDEX, europe, (node: CascaderNode): boolean => node.label.startsWith("E"))).toBe(true);
		expect(cascaderCheckStateOf(INDEX, europe, ["zrh"])).toBe("partial");
		const all = toggleCascaderCascade(INDEX, europe, ["zrh"]);
		expect(all).toStrictEqual(["zrh", "gva", "ber"]);
		expect(cascaderCheckStateOf(INDEX, europe, all)).toBe("checked");
		expect(toggleCascaderCascade(INDEX, europe, all)).toStrictEqual([]);
		expect(toggleCascaderCascade(INDEX, europe, [], 2)).toStrictEqual(["zrh", "gva"]);
		expect(cascaderCheckStateOf(INDEX, europe, [])).toBe("none");
		expect(toggleCascaderValue(["a"], "b", 1)).toStrictEqual(["a"]);
		expect(toggleCascaderValue(["a", "b"], "a")).toStrictEqual(["b"]);
	});
});

describe("searchCascader", () => {
	it("searches a level, below it, or the whole tree, ignoring accents and matching keywords", () => {
		expect(searchCascader(INDEX, "zurich", "deep").map((hit) => hit.node.value)).toStrictEqual(["zrh"]);
		expect(searchCascader(INDEX, "nations", "global").map((hit) => hit.path.length)).toStrictEqual([3]);
		expect(searchCascader(INDEX, "ber", "level", "de").map((hit) => hit.node.value)).toStrictEqual(["ber"]);
		expect(searchCascader(INDEX, "ber", "deep", "ch")).toStrictEqual([]);
		expect(searchCascader(INDEX, " ", "global")).toStrictEqual([]);
		expect(foldCascaderText("Zürich")).toBe("zurich");
	});
});

describe("paths", () => {
	it("writes a path in full, as its last part, or shortened in the middle or at the start", () => {
		const path = cascaderPathOf(INDEX, "zrh");
		expect(formatCascaderPath(path)).toBe("Europe / Switzerland / Zürich");
		expect(formatCascaderPath(path, { separator: " › ", display: "leaf", collapse: "none", maxSegments: 3 })).toBe("Zürich");
		expect(cascaderPathSegments(["a", "b", "c", "d"], "middle", 3)).toStrictEqual(["a", "…", "d"]);
		expect(cascaderPathSegments(["a", "b", "c", "d"], "start", 3)).toStrictEqual(["…", "c", "d"]);
		expect(cascaderPathSegments(["a", "b", "c", "d"], "none", 2)).toStrictEqual(["a", "b", "c", "d"]);
	});

	it("nests flat rows by their parent pointer", () => {
		const tree = cascaderTreeFromRows([
			{ id: "eng", parentId: "hq", label: "Engineering" },
			{ id: "hq", parentId: null, label: "Headquarters" },
			{ id: "orphan", parentId: "gone", label: "Orphan" },
		]);
		expect(tree.map((node) => node.value)).toStrictEqual(["hq"]);
		expect(tree.at(0)?.children?.map((node) => node.value)).toStrictEqual(["eng"]);
	});
});
