import { abbreviateMonth, chartDataOf, formatCount, formatScore, formatUsd } from "../examples/chart/chart-sample";

describe("the chart examples' formats", () => {
	it("abbreviates months, separates thousands and writes dollars and scores", () => {
		expect(abbreviateMonth("September")).toBe("Sep");
		expect(formatCount(12800)).toBe("12,800");
		expect(formatCount(1234567.4)).toBe("1,234,567");
		expect(formatCount(950)).toBe("950");
		expect(formatUsd(2400)).toBe("$2,400");
		expect(formatScore(76)).toBe("76/100");
	});

	it("turns the web's rows into chart data, labelled by the key it names", () => {
		expect(chartDataOf([{ month: "Jan", desktop: 300, mobile: 120 }], "month")).toEqual([{ label: "Jan", values: { desktop: 300, mobile: 120 } }]);
		expect(chartDataOf([{ desktop: 1 }], "month")).toEqual([{ label: "", values: { desktop: 1 } }]);
	});
});
