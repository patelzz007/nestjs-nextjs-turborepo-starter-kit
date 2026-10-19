import { describe, expect, it } from "vitest";

import { EMAIL_FIELD_NAMES, isEmailField, isPersonalDataField, normalizeAuditFieldName, PII_FIELD_NAMES } from "../audit-data-policy";

describe("normalizeAuditFieldName", () => {
	it("lower-cases and drops every separator", () => {
		expect(normalizeAuditFieldName("Full_Name")).toBe("fullname");
		expect(normalizeAuditFieldName("contact-email")).toBe("contactemail");
		expect(normalizeAuditFieldName("addressLine1")).toBe("addressline1");
	});
});

describe("isPersonalDataField", () => {
	it("matches a personal-data name whatever its casing or separators (JSON keys and SQL columns alike)", () => {
		expect(isPersonalDataField("fullName")).toBe(true);
		expect(isPersonalDataField("full_name")).toBe(true);
		expect(isPersonalDataField("contact_phone")).toBe(true);
		expect(isPersonalDataField("address_text")).toBe(true);
	});

	it("does not match a field that only contains a personal-data word", () => {
		expect(isPersonalDataField("email_verified_at")).toBe(false);
		expect(isPersonalDataField("display_name")).toBe(false);
	});
});

describe("isEmailField", () => {
	it("matches the email fields only", () => {
		expect(isEmailField("contact_email")).toBe(true);
		expect(isEmailField("phone")).toBe(false);
	});

	it("is a subset of the personal-data fields, so every email is masked", () => {
		for (const name of EMAIL_FIELD_NAMES) {
			expect(PII_FIELD_NAMES.has(name)).toBe(true);
		}
	});
});
