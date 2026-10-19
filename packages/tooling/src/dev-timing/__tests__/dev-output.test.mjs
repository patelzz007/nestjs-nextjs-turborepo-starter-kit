import { describe, expect, it } from "vitest";

import { API_DEV_TASK, ApiBootRecorder, isRspackCompiledMessage, parseMarkPhase, parseTurboLine } from "../dev-output.mjs";

/** ANSI colour codes as turbo prints them in a terminal. */
const ESC = String.fromCharCode(27);
const colour = (text) => `${ESC}[36m${text}${ESC}[0m`;

describe("parseTurboLine", () => {
	it("splits turbo's stream prefix from the message, stripping colours", () => {
		expect(parseTurboLine(`${colour("@workspace/api:dev:")} Rspack compiled successfully in 812 ms`)).toEqual({
			task: API_DEV_TASK,
			message: "Rspack compiled successfully in 812 ms",
		});
	});

	it("accepts an empty message", () => {
		expect(parseTurboLine("@workspace/web:dev: ")).toEqual({ task: "@workspace/web:dev", message: "" });
	});

	it("is undefined for a line without a task prefix", () => {
		expect(parseTurboLine("• Packages in scope: @workspace/api")).toBeUndefined();
	});
});

describe("isRspackCompiledMessage", () => {
	it.each([
		["Rspack compiled successfully", true],
		["Rspack compiled successfully in 812 ms", true],
		["Rspack compiled with 2 warnings in 1.2 s", true],
		["Rspack compiling...", false],
		["✓ NestJS app created (+120ms, 300ms total)", false],
	])("%s → %s", (message, expected) => {
		expect(isRspackCompiledMessage(message)).toBe(expected);
	});
});

describe("parseMarkPhase", () => {
	it("reads the label, step and total of a markPhase line", () => {
		expect(parseMarkPhase("✓ Server listening on 0.0.0.0:8080 (+35ms, 2140ms total) [heap: 210.4MB]")).toEqual({
			label: "Server listening on 0.0.0.0:8080",
			stepMs: 35,
			totalMs: 2_140,
		});
	});

	it("is undefined for any other line", () => {
		expect(parseMarkPhase("[Nest] 123 - LOG [RoutesResolver] HealthController {/health}")).toBeUndefined();
	});
});

describe("ApiBootRecorder", () => {
	function recorderAt(times) {
		let index = 0;
		return new ApiBootRecorder(() => {
			const time = times.at(index) ?? Number.NaN;
			index += 1;
			return time;
		});
	}

	it("records the clock at the API's first compile and the first boot's markPhase lines", () => {
		const recorder = recorderAt([1_500, 9_999]);
		recorder.accept("@workspace/api:dev: ✓ Environment validated (+1ms, 1ms total) [heap: 50.0MB]");
		recorder.accept("@workspace/web:dev: Rspack compiled successfully");
		recorder.accept("@workspace/api:dev: Rspack compiled successfully in 4 s");
		recorder.accept("@workspace/api:dev: ✓ Environment validated (+12ms, 12ms total) [heap: 60.1MB]");
		recorder.accept("@workspace/api:dev: ✓ NestJS app created (+900ms, 912ms total) [heap: 180.0MB]");
		recorder.accept("@workspace/api:dev: ✓ Server listening on 127.0.0.1:8080 (+40ms, 952ms total) [heap: 181.0MB]");
		recorder.accept("@workspace/api:dev: Rspack compiled successfully in 1 s");
		recorder.accept("@workspace/api:dev: ✓ Environment validated (+10ms, 10ms total) [heap: 61.0MB]");
		expect(recorder.compiledAt).toBe(1_500);
		expect(recorder.phases.map((phase) => phase.label)).toEqual(["Environment validated", "NestJS app created", "Server listening on 127.0.0.1:8080"]);
	});

	it("has nothing before the API compiles", () => {
		const recorder = recorderAt([]);
		recorder.accept("@workspace/api:dev: $ rspack --watch --mode development");
		expect(recorder.compiledAt).toBeUndefined();
		expect(recorder.phases).toEqual([]);
	});
});
