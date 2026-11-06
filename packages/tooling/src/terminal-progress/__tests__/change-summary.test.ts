import { describe, expect, it } from "vitest";

import { describePush, describeStaged, parseCommits, parseNumstat, parsePushRefs, type GitReader } from "../change-summary.ts";

const ZERO = "0000000000000000000000000000000000000000";
const LOCAL = "aaaaaaaa";
const REMOTE = "bbbbbbbb";
const REF = { localRef: "refs/heads/main", localOid: LOCAL, remoteRef: "refs/heads/main", remoteOid: REMOTE };

function fakeGit(log: string, numstat: string, seen: string[][] = []): GitReader {
	return (args) => {
		seen.push([...args]);
		return args.includes("--numstat") ? numstat : log;
	};
}

describe("parseNumstat", () => {
	it("reads files, and adds up a path changed by several commits", () => {
		expect(parseNumstat("3\t1\tsrc/a.ts\n\n2\t0\tsrc/a.ts\n1\t1\tsrc/b.ts\n")).toStrictEqual([
			{ path: "src/a.ts", added: 5, removed: 1 },
			{ path: "src/b.ts", added: 1, removed: 1 },
		]);
	});

	it("has no line counts for a binary file, and skips anything else", () => {
		expect(parseNumstat("-\t-\tlogo.png\nnot a numstat line\n")).toStrictEqual([{ path: "logo.png", added: undefined, removed: undefined }]);
	});
});

describe("parseCommits", () => {
	it("splits hash from subject", () => {
		expect(parseCommits("abc1234\tFix the thing\nnot-a-commit\n")).toStrictEqual([{ hash: "abc1234", subject: "Fix the thing" }]);
	});
});

describe("parsePushRefs", () => {
	it("reads git's lines and leaves deletions out", () => {
		const text = `refs/heads/main ${LOCAL} refs/heads/main ${REMOTE}\n(delete) ${ZERO} refs/heads/old ${REMOTE}\ngarbage\n`;

		expect(parsePushRefs(text)).toStrictEqual([REF]);
	});
});

describe("describePush", () => {
	it("sums up the commits and files", () => {
		const summary = describePush([REF], "origin", fakeGit("abc\tOne\ndef\tTwo\n", "3\t1\tsrc/a.ts\n"));

		expect(summary.headline).toBe("main → origin/main · 2 commits · 1 file · +3 −1");
		expect(summary.commits).toHaveLength(2);
		expect(summary.files).toHaveLength(1);
	});

	it("walks what the remote lacks, or for a new branch what no remote has", () => {
		const seen: string[][] = [];
		describePush([REF, { ...REF, remoteOid: ZERO }], "origin", fakeGit("", "", seen));

		expect(seen.flat()).toContain(`${REMOTE}..${LOCAL}`);
		expect(seen.flat()).toContain("--not");
	});

	it("mentions further branches", () => {
		expect(describePush([REF, { ...REF, localRef: "refs/heads/next" }], "origin", fakeGit("", "")).headline).toContain("main → origin/main and 1 more");
	});

	it("still says something when run by hand with no refs", () => {
		expect(describePush([], "origin", fakeGit("", "")).headline).toContain("Pushing to origin");
	});
});

describe("describeStaged", () => {
	it("sums up the branch and the staged files", () => {
		const git: GitReader = (args) => (args.includes("--show-current") ? "main\n" : "2\t2\tsrc/a.ts\n1\t0\tsrc/b.ts\n");

		expect(describeStaged(git).headline).toBe("main · 2 staged files · +3 −2");
	});

	it("leaves the branch out on a detached HEAD", () => {
		expect(describeStaged(() => "").headline).toBe("0 staged files · +0 −0");
	});
});
