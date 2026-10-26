import { AUDIT_ERROR_CAUSES_MAX_COUNT, AUDIT_ERROR_MESSAGE_MAX_LENGTH, AUDIT_ERROR_STACK_MAX_FRAMES, AUDIT_TRUNCATION_MARK } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { auditErrorDetail, redactErrorText, NON_ERROR_THROWN } from "../audit-error-detail";

const CWD = "/srv/app";
const WITH_STACK = { withStack: true, workingDirectory: CWD };
const NO_STACK = { withStack: false, workingDirectory: CWD };

/** An error whose stack is exactly `frames` under its message line. */
function errorWithStack(message: string, frames: readonly string[]): Error {
	const error = new Error(message);
	error.stack = [`Error: ${message}`, ...frames.map((frame: string): string => `    at ${frame}`)].join("\n");
	return error;
}

class PrismaLikeError extends Error {
	public readonly code: string = "P2025";

	public constructor(message: string) {
		super(message);
		this.name = "PrismaClientKnownRequestError";
	}
}

class NamedByClassError extends Error {}

describe("auditErrorDetail", () => {
	it("records the real class, message and machine code of what was thrown", () => {
		expect(auditErrorDetail(new PrismaLikeError("Record to update not found."), NO_STACK)).toEqual({
			type: "PrismaClientKnownRequestError",
			message: "Record to update not found.",
			code: "P2025",
			causes: [],
			stack: [],
		});
	});

	it("names a plain-`Error` subclass by its class", () => {
		expect(auditErrorDetail(new NamedByClassError("boom"), NO_STACK).type).toBe("NamedByClassError");
	});

	it("follows the cause chain, outermost first, and stops at a cycle", () => {
		const root = new Error("connect ECONNREFUSED 127.0.0.1:5432");
		const middle = new Error("pool exhausted", { cause: root });
		const outer = new Error("could not load reward", { cause: middle });
		root.cause = outer;

		expect(auditErrorDetail(outer, NO_STACK).causes).toEqual([
			{ type: "Error", message: "pool exhausted", code: null },
			{ type: "Error", message: "connect ECONNREFUSED 127.0.0.1:5432", code: null },
		]);
	});

	it("keeps at most the bounded number of causes", () => {
		let error = new Error("cause 0");
		for (let depth = 1; depth <= AUDIT_ERROR_CAUSES_MAX_COUNT + 3; depth += 1) {
			error = new Error(`cause ${String(depth)}`, { cause: error });
		}
		expect(auditErrorDetail(error, NO_STACK).causes).toHaveLength(AUDIT_ERROR_CAUSES_MAX_COUNT);
	});

	it("keeps where it was thrown only when asked (a server fault), relative to the working directory, without Node internals", () => {
		const error = errorWithStack("boom", [
			"Handler.execute (/srv/app/src/handler.ts:42:13)",
			"process.processTicksAndRejections (node:internal/process/task_queues:105:5)",
			"async node:internal/modules/esm/loader:647:26",
			"run (file:///srv/app/src/main.ts:1:1)",
		]);

		expect(auditErrorDetail(error, WITH_STACK).stack).toEqual(["at Handler.execute (src/handler.ts:42:13)", "at run (src/main.ts:1:1)"]);
		expect(auditErrorDetail(error, NO_STACK).stack).toEqual([]);
	});

	it("keeps at most the bounded number of stack frames", () => {
		const frames: string[] = Array.from({ length: AUDIT_ERROR_STACK_MAX_FRAMES + 5 }, (_, index: number): string => `fn${String(index)} (/srv/app/src/a.ts:1:1)`);
		expect(auditErrorDetail(errorWithStack("deep", frames), WITH_STACK).stack).toHaveLength(AUDIT_ERROR_STACK_MAX_FRAMES);
	});

	it("masks e-mail addresses inside messages, like every stored payload", () => {
		expect(auditErrorDetail(new Error("No account for jane.doe@example.com"), NO_STACK).message).toBe("No account for j***@example.com");
	});

	it("cuts an over-long message and marks the cut", () => {
		const message: string = auditErrorDetail(new Error("x".repeat(AUDIT_ERROR_MESSAGE_MAX_LENGTH + 10)), NO_STACK).message;
		expect(message).toHaveLength(AUDIT_ERROR_MESSAGE_MAX_LENGTH);
		expect(message.endsWith(AUDIT_TRUNCATION_MARK)).toBe(true);
	});

	it("describes a thrown value that is not an Error", () => {
		expect(auditErrorDetail("plain string", WITH_STACK)).toEqual({ type: NON_ERROR_THROWN, message: "plain string", code: null, causes: [], stack: [] });
	});
});

describe("redactErrorText", () => {
	it("redacts the credentials of a URL, keeping where it points", () => {
		expect(redactErrorText("connect failed: postgres://app:s3cret@db.internal:5432/app")).toBe("connect failed: postgres://[REDACTED]@db.internal:5432/app");
	});

	it("keeps the first character and the domain of every address", () => {
		expect(redactErrorText("from a.b@x.io to zed@y.example.com")).toBe("from a***@x.io to z***@y.example.com");
		expect(redactErrorText("no address here")).toBe("no address here");
	});
});
