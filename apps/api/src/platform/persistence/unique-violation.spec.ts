import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { isUniqueViolationOf } from "./unique-violation";

const CLIENT_VERSION = "test";

function uniqueViolationOn(index: string): Prisma.PrismaClientKnownRequestError {
	return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
		code: "P2002",
		clientVersion: CLIENT_VERSION,
		meta: { driverAdapterError: { cause: { constraint: { index } } } },
	});
}

describe("isUniqueViolationOf", () => {
	it("matches a unique violation of exactly the named index", () => {
		expect(isUniqueViolationOf(uniqueViolationOn("users_email_key"), "users_email_key")).toBe(true);
	});

	it("does not match a unique violation of another index", () => {
		expect(isUniqueViolationOf(uniqueViolationOn("signup_referral_codes_code_key"), "users_email_key")).toBe(false);
	});

	it("does not match another Prisma error code or a plain error", () => {
		const notFound = new Prisma.PrismaClientKnownRequestError("Not found", { code: "P2025", clientVersion: CLIENT_VERSION });

		expect(isUniqueViolationOf(notFound, "users_email_key")).toBe(false);
		expect(isUniqueViolationOf(new Error("boom"), "users_email_key")).toBe(false);
	});

	it("does not match a unique violation whose meta has an unexpected shape", () => {
		const opaque = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: CLIENT_VERSION, meta: { target: ["email"] } });

		expect(isUniqueViolationOf(opaque, "users_email_key")).toBe(false);
	});
});
