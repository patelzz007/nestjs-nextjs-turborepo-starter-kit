import {
	arcPath,
	chartAreaPath,
	chartBands,
	chartBarPath,
	chartLinePath,
	chartPointXs,
	niceScale,
	pieSlices,
	polarPoint,
	polygonPath,
	radarPoints,
	radialSweep,
	stackedTotals,
} from "../chart";

const TURN = Math.PI * 2;

describe("niceScale", () => {
	it("rounds the top up to a readable step", () => {
		expect(niceScale(925)).toEqual({ top: 1000, step: 250 });
		expect(niceScale(110)).toEqual({ top: 150, step: 50 });
		expect(niceScale(3.2)).toEqual({ top: 4, step: 1 });
	});

	it("still has a scale with nothing to show", () => {
		expect(niceScale(0).top).toBe(1);
	});
});

describe("chartBands", () => {
	it("splits the length into equal slots, each band centred with its gap around it", () => {
		const [first, second] = chartBands(2, 100, 0.2);
		expect(first).toEqual({ start: 5, size: 40, center: 25 });
		expect(second).toEqual({ start: 55, size: 40, center: 75 });
	});

	it("has no bands for no categories", () => {
		expect(chartBands(0, 100, 0.2)).toEqual([]);
	});
});

describe("chartPointXs", () => {
	it("spreads points from edge to edge, or centres a single one", () => {
		expect(chartPointXs(3, 100)).toEqual([0, 50, 100]);
		expect(chartPointXs(1, 100)).toEqual([50]);
	});
});

describe("chartLinePath", () => {
	const points = [
		{ x: 0, y: 10 },
		{ x: 10, y: 0 },
		{ x: 20, y: 10 },
	];

	it("joins points with straight segments", () => {
		expect(chartLinePath(points, "linear")).toBe("M0.00,10.00 L10.00,0.00 L20.00,10.00");
	});

	it("holds each value flat until the next with a step", () => {
		expect(chartLinePath(points, "step")).toBe("M0.00,10.00 L10.00,10.00 L10.00,0.00 L20.00,0.00 L20.00,10.00");
	});

	it("curves smoothly through every point", () => {
		const path = chartLinePath(points, "natural");
		expect(path.startsWith("M0.00,10.00 C")).toBe(true);
		expect(path.endsWith(" 20.00,10.00")).toBe(true);
		expect(path.match(/C/gu)).toHaveLength(2);
	});

	it("is empty with no points", () => {
		expect(chartLinePath([], "linear")).toBe("");
	});
});

describe("chartAreaPath", () => {
	it("closes the area between the top line and the baseline", () => {
		const top = [
			{ x: 0, y: 2 },
			{ x: 10, y: 4 },
		];
		const bottom = [
			{ x: 0, y: 10 },
			{ x: 10, y: 10 },
		];
		expect(chartAreaPath(top, bottom, "linear")).toBe("M0.00,2.00 L10.00,4.00 L10.00,10.00 L0.00,10.00 Z");
		expect(chartAreaPath([], bottom, "linear")).toBe("");
	});
});

describe("stackedTotals", () => {
	it("adds each series onto the ones below it", () => {
		expect(
			stackedTotals([
				[1, 2],
				[3, 4],
				[5, 6],
			]),
		).toEqual([
			[1, 2],
			[4, 6],
			[9, 12],
		]);
	});
});

describe("chartBarPath", () => {
	it("rounds a vertical bar's top and a horizontal bar's end, never past half its width", () => {
		expect(chartBarPath(0, 0, 10, 20, 4, "vertical")).toBe("M0.00,20.00 L0.00,4.00 Q0.00,0.00 4.00,0.00 L6.00,0.00 Q10.00,0.00 10.00,4.00 L10.00,20.00 Z");
		expect(chartBarPath(0, 0, 20, 10, 4, "horizontal")).toBe("M0.00,0.00 L16.00,0.00 Q20.00,0.00 20.00,4.00 L20.00,6.00 Q20.00,10.00 16.00,10.00 L0.00,10.00 Z");
		expect(chartBarPath(0, 0, 4, 20, 10, "vertical")).toContain("Q0.00,0.00 2.00,0.00");
	});
});

describe("polar geometry", () => {
	it("measures angles clockwise from twelve o'clock", () => {
		const top = polarPoint(0, 0, 10, 0);
		const right = polarPoint(0, 0, 10, Math.PI / 2);
		expect(top.x).toBeCloseTo(0);
		expect(top.y).toBeCloseTo(-10);
		expect(right.x).toBeCloseTo(10);
		expect(right.y).toBeCloseTo(0);
	});

	it("shares the turn among slices, padding between them", () => {
		const [first, second] = pieSlices([1, 3], 0.1);
		expect(first?.start).toBeCloseTo(0.05);
		expect((first?.end ?? 0) - (first?.start ?? 0)).toBeCloseTo((TURN - 0.2) / 4);
		expect((second?.end ?? 0) - (second?.start ?? 0)).toBeCloseTo(((TURN - 0.2) * 3) / 4);
		expect(pieSlices([5], 0.1)).toEqual([{ start: 0, end: TURN }]);
		expect(pieSlices([0, 0], 0.1)).toEqual([
			{ start: 0, end: 0 },
			{ start: 0, end: 0 },
		]);
	});

	it("draws ring slices and wedges, with the large-arc flag past half a turn", () => {
		expect(arcPath(0, 0, 5, 10, 0, Math.PI / 2)).toMatch(/^M0\.00,-10\.00 A10,10 0 0 1 10\.00,0\.00 L5\.00,0\.00 A5,5 0 0 0 0\.00,-5\.00 Z$/u);
		expect(arcPath(0, 0, 0, 10, 0, Math.PI * 1.5)).toMatch(/^M0\.00,0\.00 L0\.00,-10\.00 A10,10 0 1 1 /u);
	});

	it("places radar corners by value, clamped to the scale", () => {
		const [up, right] = radarPoints(0, 0, 100, [50, 200, 0, 0], 100);
		expect(up?.y).toBeCloseTo(-50);
		expect(right?.x).toBeCloseTo(100);
		expect(polygonPath([{ x: 0, y: 0 }])).toBe("M0.00,0.00 Z");
		expect(polygonPath([])).toBe("");
	});

	it("fills a radial bar's share of a turn", () => {
		expect(radialSweep(50, 100)).toBeCloseTo(Math.PI);
		expect(radialSweep(150, 100)).toBeCloseTo(TURN);
	});
});
