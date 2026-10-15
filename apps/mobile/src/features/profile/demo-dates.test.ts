import { demoDateBoundsOf } from "./demo-dates";

describe("demoDateBoundsOf", () => {
	it("lets a birth date run from 1 January a hundred years back to today", () => {
		expect(demoDateBoundsOf("2026-10-16").birth).toStrictEqual({ minDate: "1926-01-01", maxDate: "2026-10-16" });
	});

	it("lets available days run from today to the end of next year", () => {
		expect(demoDateBoundsOf("2026-10-16").availability).toStrictEqual({ minDate: "2026-10-16", maxDate: "2027-12-31" });
	});
});
