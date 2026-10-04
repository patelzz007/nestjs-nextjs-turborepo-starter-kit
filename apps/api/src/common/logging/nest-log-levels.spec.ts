import type { LogLevel as NestLogLevel } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { LogLevelSchema, type LogLevel } from "../../config/api-env.fields";
import { nestLoggerLevelsFor } from "./nest-log-levels";

type Expectation = [LogLevel, NestLogLevel[] | false];

const EXPECTED: Expectation[] = [
	["fatal", ["fatal"]],
	["error", ["fatal", "error"]],
	["warn", ["fatal", "error", "warn"]],
	["info", ["fatal", "error", "warn", "log"]],
	["debug", ["fatal", "error", "warn", "log", "debug"]],
	["trace", ["fatal", "error", "warn", "log", "debug", "verbose"]],
	["silent", false],
];

describe("nestLoggerLevelsFor", () => {
	it.each(EXPECTED)("LOG_LEVEL=%s prints exactly the Nest levels %j", (level: LogLevel, expected: NestLogLevel[] | false) => {
		expect(nestLoggerLevelsFor(level)).toEqual(expected);
	});

	it("covers every LOG_LEVEL the config accepts", () => {
		expect(EXPECTED.map(([level]) => level).sort()).toEqual([...LogLevelSchema.options].sort());
	});

	it("keeps debug lines out at the default level (warn)", () => {
		const levels: NestLogLevel[] | false = nestLoggerLevelsFor("warn");
		expect(levels).not.toContain("debug");
		expect(levels).not.toContain("log");
	});
});
