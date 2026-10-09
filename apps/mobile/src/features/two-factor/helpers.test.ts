import { backupCodesNotice, LOW_BACKUP_CODES_THRESHOLD } from "./backup-codes-status";
import { groupSetupKey } from "./setup-key";

describe("groupSetupKey", () => {
	it("groups the key in fours", () => {
		expect(groupSetupKey("JBSWY3DPEHPK3PXP")).toBe("JBSW Y3DP EHPK 3PXP");
		expect(groupSetupKey("ABCDEF")).toBe("ABCD EF");
		expect(groupSetupKey("")).toBe("");
	});
});

describe("backupCodesNotice", () => {
	it("says nothing while enough codes are left", () => {
		expect(backupCodesNotice(LOW_BACKUP_CODES_THRESHOLD + 1)).toBeNull();
	});

	it("warns when codes are running low, and when none are left", () => {
		expect(backupCodesNotice(1)).toBe("Only 1 backup code is left. Generate new ones in Security settings.");
		expect(backupCodesNotice(LOW_BACKUP_CODES_THRESHOLD)).toBe("Only 3 backup codes are left. Generate new ones in Security settings.");
		expect(backupCodesNotice(0)).toContain("no backup codes left");
	});
});
