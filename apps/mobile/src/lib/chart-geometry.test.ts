import {
	arcPath,
	areaPath,
	intensityLevel,
	linePath,
	nearestIndex,
	niceTicks,
	pointOnCircle,
	pointsOf,
	progressShare,
	ringSpans,
	scaleTop,
	xOf,
	yOf,
	type ChartPoint,
} from "./chart-geometry";

describe("niceTicks", () => {
	it("steps in round numbers from zero to at least the maximum", () => {
		expect(niceTicks(312, 4)).toStrictEqual([0, 100, 200, 300, 400]);
		expect(niceTicks(9, 4)).toStrictEqual([0, 2.5, 5, 7.5, 10]);
		expect(niceTicks(1800, 3)).toStrictEqual([0, 1000, 2000]);
	});

	it("ends exactly on a maximum that is already round", () => {
		expect(niceTicks(400, 4)).toStrictEqual([0, 100, 200, 300, 400]);
	});

	it("gives an all-zero series the ticks of 1, so the axis never collapses", () => {
		expect(niceTicks(0, 2)).toStrictEqual([0, 0.5, 1]);
	});
});

describe("scaleTop", () => {
	it("is the highest tick, or 1 without ticks", () => {
		expect(scaleTop([0, 50, 100])).toBe(100);
		expect(scaleTop([])).toBe(1);
	});
});

describe("xOf and yOf", () => {
	it("spreads values evenly across the width, a single one in the middle", () => {
		expect(xOf(0, 5, 200)).toBe(0);
		expect(xOf(4, 5, 200)).toBe(200);
		expect(xOf(2, 5, 200)).toBe(100);
		expect(xOf(0, 1, 200)).toBe(100);
	});

	it("puts zero at the bottom and the top of the scale at the top", () => {
		expect(yOf(0, 400, 160)).toBe(160);
		expect(yOf(400, 400, 160)).toBe(0);
		expect(yOf(100, 400, 160)).toBe(120);
	});
});

describe("pointsOf", () => {
	it("maps each value to its point on the plot", () => {
		expect(pointsOf([0, 50, 100], 100, { width: 100, height: 50 })).toStrictEqual([
			{ x: 0, y: 50 },
			{ x: 50, y: 25 },
			{ x: 100, y: 0 },
		]);
	});
});

describe("nearestIndex", () => {
	it("picks the value nearest the touch", () => {
		expect(nearestIndex(0, 5, 200)).toBe(0);
		expect(nearestIndex(49, 5, 200)).toBe(1);
		expect(nearestIndex(200, 5, 200)).toBe(4);
	});

	it("clamps a touch outside the plot to its first or last value", () => {
		expect(nearestIndex(-30, 5, 200)).toBe(0);
		expect(nearestIndex(260, 5, 200)).toBe(4);
	});

	it("is the only value for one value or an unmeasured plot", () => {
		expect(nearestIndex(120, 1, 200)).toBe(0);
		expect(nearestIndex(120, 5, 0)).toBe(0);
	});
});

describe("linePath", () => {
	const POINTS: readonly ChartPoint[] = [
		{ x: 0, y: 40 },
		{ x: 30, y: 10 },
		{ x: 60, y: 40 },
	];

	it("starts at the first point and curves through every other one", () => {
		const path = linePath(POINTS);

		expect(path.startsWith("M 0 40 ")).toBe(true);
		expect(path.endsWith(" 60 40")).toBe(true);
		expect(path.match(/C /gu)).toHaveLength(2);
	});

	it("levels the curve at a peak, so it never rises above it", () => {
		// The control points next to the peak (x 30, y 10) share its height.
		expect(linePath(POINTS)).toContain("C 10 30 20 10 30 10");
	});

	it("is a lone move for one point and empty for none", () => {
		expect(linePath([{ x: 5, y: 5 }])).toBe("M 5 5");
		expect(linePath([])).toBe("");
	});
});

describe("areaPath", () => {
	it("closes the line down to the baseline", () => {
		const path = areaPath(
			[
				{ x: 0, y: 10 },
				{ x: 50, y: 20 },
			],
			60,
		);

		expect(path.startsWith("M 0 10 ")).toBe(true);
		expect(path.endsWith("L 50 60 L 0 60 Z")).toBe(true);
	});

	it("is empty for no points", () => {
		expect(areaPath([], 60)).toBe("");
	});
});

describe("pointOnCircle", () => {
	it("starts at 12 o'clock and turns clockwise", () => {
		const center: ChartPoint = { x: 50, y: 50 };

		expect(pointOnCircle(center, 10, 0)).toStrictEqual({ x: 50, y: 40 });
		const quarter = pointOnCircle(center, 10, 0.25);
		expect(quarter.x).toBeCloseTo(60);
		expect(quarter.y).toBeCloseTo(50);
	});
});

describe("arcPath", () => {
	const CENTER: ChartPoint = { x: 50, y: 50 };

	it("draws a short arc clockwise from its start to its end", () => {
		expect(arcPath(CENTER, 10, { start: 0, end: 0.25 })).toBe("M 50 40 A 10 10 0 0 1 60 50");
	});

	it("sets the large-arc flag past half a turn", () => {
		expect(arcPath(CENTER, 10, { start: 0, end: 0.75 })).toBe("M 50 40 A 10 10 0 1 1 40 50");
	});

	it("draws a whole turn as two halves, and nothing for no length", () => {
		expect(arcPath(CENTER, 10, { start: 0, end: 1 })).toBe("M 50 40 A 10 10 0 0 1 50 60 A 10 10 0 0 1 50 40");
		expect(arcPath(CENTER, 10, { start: 0.3, end: 0.3 })).toBe("");
	});
});

describe("ringSpans", () => {
	it("gives each value its share of the ring, in order, with a gap between parts", () => {
		expect(ringSpans([1, 3], 0.02)).toStrictEqual([
			{ start: 0.01, end: 0.24 },
			{ start: 0.26, end: 0.99 },
		]);
	});

	it("leaves zero values out and gives a lone value the whole ring", () => {
		expect(ringSpans([0, 5, 0], 0.02)).toStrictEqual([null, { start: 0, end: 1 }, null]);
		expect(ringSpans([0, 0], 0.02)).toStrictEqual([null, null]);
	});
});

describe("progressShare", () => {
	it("is the share of the target reached, clamped to a full ring", () => {
		expect(progressShare(30, 120)).toBe(0.25);
		expect(progressShare(150, 120)).toBe(1);
		expect(progressShare(-5, 120)).toBe(0);
		expect(progressShare(5, 0)).toBe(0);
	});
});

describe("intensityLevel", () => {
	it("is 0 for nothing and slices the rest into equal steps", () => {
		expect(intensityLevel(0, 8, 4)).toBe(0);
		expect(intensityLevel(2, 8, 4)).toBe(1);
		expect(intensityLevel(5, 8, 4)).toBe(3);
		expect(intensityLevel(8, 8, 4)).toBe(4);
	});

	it("lifts any activity to the first step and never passes the last", () => {
		expect(intensityLevel(0.1, 100, 4)).toBe(1);
		expect(intensityLevel(12, 8, 4)).toBe(4);
		expect(intensityLevel(3, 0, 4)).toBe(0);
	});
});
