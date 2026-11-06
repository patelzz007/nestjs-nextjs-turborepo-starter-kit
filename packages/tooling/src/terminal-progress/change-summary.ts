// What a commit or a push contains, read from git for the hooks' dashboard. Git's answers are only shown: when one
// fails (a remote commit that was never fetched, say), the summary is shorter and the hook carries on.
import { formatCount, plural } from "./text.ts";

export interface ChangedFile {
	readonly path: string;
	/** Undefined for a binary file, which has no lines to count. */
	readonly added: number | undefined;
	readonly removed: number | undefined;
}

export interface CommitLine {
	readonly hash: string;
	readonly subject: string;
}

export interface ChangeSummary {
	/** One line: what this is, ready for the header. */
	readonly headline: string;
	readonly commits: readonly CommitLine[];
	readonly files: readonly ChangedFile[];
}

/** One ref of a push, as git hands it to the hook. */
export interface PushRef {
	readonly localRef: string;
	readonly localOid: string;
	readonly remoteRef: string;
	readonly remoteOid: string;
}

/** Runs git and gives its output, empty when it fails. */
export type GitReader = (args: readonly string[]) => string;

/** A first push of a long history needn't list all of it. */
const MAX_COMMITS = 200;
const ZERO_OBJECT_ID = /^0+$/u;
const BRANCH_PREFIX = /^refs\/heads\//u;
const NUMSTAT_LINE = /^(?<added>\d+|-)\t(?<removed>\d+|-)\t(?<path>.+)$/u;
const COMMIT_LINE = /^(?<hash>\S+)\t(?<subject>.*)$/u;
const PUSH_REF = /^(?<localRef>\S+)\s+(?<localOid>\S+)\s+(?<remoteRef>\S+)\s+(?<remoteOid>\S+)$/u;

function nonEmptyLines(text: string): readonly string[] {
	return text.split("\n").filter((line) => line.trim().length > 0);
}

function lineCount(value: string | undefined): number | undefined {
	return value === undefined || value === "-" ? undefined : Number(value);
}

/** `git … --numstat`, a path that appears more than once (one per commit) counted together. */
export function parseNumstat(output: string): readonly ChangedFile[] {
	const files = new Map<string, ChangedFile>();
	for (const line of nonEmptyLines(output)) {
		const { added, removed, path } = NUMSTAT_LINE.exec(line)?.groups ?? {};
		if (path !== undefined) {
			const known = files.get(path);
			const addedNow = lineCount(added);
			const removedNow = lineCount(removed);
			files.set(path, {
				path,
				added: addedNow === undefined ? known?.added : addedNow + (known?.added ?? 0),
				removed: removedNow === undefined ? known?.removed : removedNow + (known?.removed ?? 0),
			});
		}
	}
	return [...files.values()];
}

export function parseCommits(output: string): readonly CommitLine[] {
	return nonEmptyLines(output).flatMap((line) => {
		const { hash, subject } = COMMIT_LINE.exec(line)?.groups ?? {};
		return hash === undefined || subject === undefined ? [] : [{ hash, subject }];
	});
}

/** The refs a push sends, leaving out the ones it deletes. */
export function parsePushRefs(stdin: string): readonly PushRef[] {
	return nonEmptyLines(stdin).flatMap((line) => {
		const { localRef, localOid, remoteRef, remoteOid } = PUSH_REF.exec(line.trim())?.groups ?? {};
		if (localRef === undefined || localOid === undefined || remoteRef === undefined || remoteOid === undefined || ZERO_OBJECT_ID.test(localOid)) {
			return [];
		}
		return [{ localRef, localOid, remoteRef, remoteOid }];
	});
}

function lineTotals(files: readonly ChangedFile[]): string {
	const added = files.reduce((sum, file) => sum + (file.added ?? 0), 0);
	const removed = files.reduce((sum, file) => sum + (file.removed ?? 0), 0);
	return `+${formatCount(added)} −${formatCount(removed)}`;
}

function branchName(ref: string): string {
	return ref.replace(BRANCH_PREFIX, "");
}

/** What `git log` should walk: what the remote lacks, or for a new branch what no remote has. */
function revisionRange({ localOid, remoteOid }: PushRef): readonly string[] {
	return ZERO_OBJECT_ID.test(remoteOid) ? [localOid, "--not", "--remotes"] : [`${remoteOid}..${localOid}`];
}

function pushTarget(refs: readonly PushRef[], remote: string): string {
	const [first, ...others] = refs;
	if (first === undefined) {
		return `Pushing to ${remote}`;
	}
	const more = others.length === 0 ? "" : ` and ${formatCount(others.length)} more`;
	return `${branchName(first.localRef)} → ${remote}/${branchName(first.remoteRef)}${more}`;
}

/** Everything a push is about to send. */
export function describePush(refs: readonly PushRef[], remote: string, git: GitReader): ChangeSummary {
	const commits = refs.flatMap((ref) => parseCommits(git(["log", `--max-count=${String(MAX_COMMITS)}`, "--format=%h%x09%s", ...revisionRange(ref)])));
	const files = parseNumstat(refs.map((ref) => git(["log", `--max-count=${String(MAX_COMMITS)}`, "--numstat", "--format=", ...revisionRange(ref)])).join("\n"));
	const parts = [pushTarget(refs, remote), plural(commits.length, "commit"), plural(files.length, "file"), lineTotals(files)];
	return { headline: parts.join(" · "), commits, files };
}

/** Everything a commit is about to record. */
export function describeStaged(git: GitReader): ChangeSummary {
	const files = parseNumstat(git(["diff", "--cached", "--numstat"]));
	const branch = git(["branch", "--show-current"]).trim();
	const parts = [...(branch === "" ? [] : [branch]), plural(files.length, "staged file"), lineTotals(files)];
	return { headline: parts.join(" · "), commits: [], files };
}
