import { describe, expect, it } from "vitest";

import { ConsumerLoginProvisioningError, parseConsumerLogin } from "./db-login";

describe("parseConsumerLogin", () => {
	it("takes the login name and (URL-decoded) password from the consumer URL", () => {
		expect(parseConsumerLogin("postgresql://analytics_consumer_app:p%40ss-word-0123456@db:5432/app")).toEqual({
			roleName: "analytics_consumer_app",
			password: "p@ss-word-0123456",
		});
	});

	it.each([
		["a non-identifier user", "postgresql://Bad-Name:long-enough-password-1@db/app"],
		["the group role itself", "postgresql://analytics_consumer:long-enough-password-1@db/app"],
		["a short password", "postgresql://analytics_consumer_app:short@db/app"],
		["no password", "postgresql://analytics_consumer_app@db/app"],
	])("refuses %s, without echoing the password", (_label, url) => {
		expect(() => parseConsumerLogin(url)).toThrow(ConsumerLoginProvisioningError);
		expect(() => parseConsumerLogin(url)).not.toThrow(/long-enough-password-1|short/);
	});
});
