import { HttpStatus } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { AppError, AppVersionUnsupportedError } from "../app-error";
import { HTTP_STATUS_UPGRADE_REQUIRED, isServerErrorStatus, standardCodeForStatus, type AppErrorHttpStatus } from "../http-status";

describe("HTTP status catalog", () => {
	it("maps known statuses to their standard code, including the 426 Nest's enum omits", () => {
		expect(standardCodeForStatus(HttpStatus.NOT_FOUND)).toBe("NOT_FOUND");
		expect(standardCodeForStatus(HTTP_STATUS_UPGRADE_REQUIRED)).toBe("APP_VERSION_UNSUPPORTED");
		expect(standardCodeForStatus(HttpStatus.GATEWAY_TIMEOUT)).toBe("GATEWAY_TIMEOUT");
	});

	it("falls back to BAD_REQUEST for an unknown 4xx and INTERNAL_ERROR for an unknown 5xx", () => {
		expect(standardCodeForStatus(HttpStatus.I_AM_A_TEAPOT)).toBe("BAD_REQUEST");
		expect(standardCodeForStatus(HttpStatus.HTTP_VERSION_NOT_SUPPORTED)).toBe("INTERNAL_ERROR");
	});

	it("treats 5xx, and only 5xx, as server errors", () => {
		expect(isServerErrorStatus(HttpStatus.INTERNAL_SERVER_ERROR)).toBe(true);
		expect(isServerErrorStatus(HttpStatus.TOO_MANY_REQUESTS)).toBe(false);
	});

	it("types an AppError's status as a Nest status or 426", () => {
		const statuses: AppErrorHttpStatus[] = [HttpStatus.CONFLICT, HTTP_STATUS_UPGRADE_REQUIRED];
		const error = new AppError({ code: "CONFLICT", httpStatus: HttpStatus.CONFLICT, message: "Conflict." });

		expect(statuses).toContain(error.httpStatus);
		expect(new AppVersionUnsupportedError().httpStatus).toBe(HTTP_STATUS_UPGRADE_REQUIRED);
	});
});
