import { describe, expect, it } from "vitest";

import { readEnvValue } from "../env-file.mjs";

describe("readEnvValue", () => {
	it("reads a plain assignment", () => {
		expect(readEnvValue("PORT=8080\nEMAIL_TEST_TO=dev@example.com\n", "EMAIL_TEST_TO")).toBe("dev@example.com");
	});

	it.each([
		['EMAIL_TEST_TO="dev@example.com"', "dev@example.com"],
		["EMAIL_TEST_TO='dev@example.com'", "dev@example.com"],
		["export EMAIL_TEST_TO=dev@example.com", "dev@example.com"],
		["EMAIL_TEST_TO = dev@example.com   # where codes go", "dev@example.com"],
		["EMAIL_TEST_TO=dev@example.com\r", "dev@example.com"],
	])("reads %j", (line, expected) => {
		expect(readEnvValue(line, "EMAIL_TEST_TO")).toBe(expected);
	});

	it.each([["# EMAIL_TEST_TO=dev@example.com"], ["EMAIL_TEST_TO="], ["OTHER_EMAIL_TEST_TO=dev@example.com"], [""]])("is undefined for %j", (source) => {
		expect(readEnvValue(source, "EMAIL_TEST_TO")).toBeUndefined();
	});

	it("takes the last assignment, as dotenv does", () => {
		expect(readEnvValue("EMAIL_TEST_TO=a@example.com\nEMAIL_TEST_TO=b@example.com", "EMAIL_TEST_TO")).toBe("b@example.com");
	});
});
