import { nextCronRunMs } from "./backup-utils";

describe("nextCronRunMs", () => {
	it("advances to the next calendar day when today's hour:minute has passed", () => {
		const from = Date.UTC(2026, 7, 18, 10, 0, 0);
		const next = nextCronRunMs("0 2 * * *", from);
		expect(next).toBe(Date.UTC(2026, 7, 19, 2, 0, 0));
	});

	it("honors Sunday (0) on weekly cron instead of firing every day", () => {
		const tuesday = Date.UTC(2026, 7, 18, 10, 0, 0);
		const next = nextCronRunMs("0 3 * * 0", tuesday);
		expect(new Date(next).getUTCDay()).toBe(0);
		expect(next).toBe(Date.UTC(2026, 7, 23, 3, 0, 0));
	});
});
