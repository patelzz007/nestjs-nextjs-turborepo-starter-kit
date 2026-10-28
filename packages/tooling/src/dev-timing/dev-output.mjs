/**
 * Parsing of `pnpm dev`'s streamed output (turbo `--ui=stream`), for
 * `pnpm tools dev:timing` (plan §19.1): which task printed a line, the moment the
 * API's rspack build finished (RunScriptWebpackPlugin spawns the API process
 * right after that emit, so it is the start of phase B), and the `markPhase`
 * lines `apps/api/src/bootstrap/bootstrap-app.ts` prints during boot.
 */
import { stripVTControlCharacters } from "node:util";

/** The turbo task id of the API's dev server. */
export const API_DEV_TASK = "@workspace/api:dev";

/** `<package>:<task>: <message>` — turbo's stream-UI prefix. */
const TURBO_LINE = /^(?<task>[@a-z0-9/._-]+:[a-z0-9:._-]+): ?(?<message>.*)$/i;
/** rspack-cli's summary after a (re)build: "Rspack compiled successfully in 812 ms" (or "with N warnings"). */
const RSPACK_COMPILED = /\bcompiled\b.*\b(?:successfully|with)\b/i;
/** `✓ <label> (+<step>ms, <total>ms total) [heap: …]` from `markPhase`. */
const MARK_PHASE = /^✓ (?<label>.+?) \(\+(?<stepMs>\d+)ms, (?<totalMs>\d+)ms total\)/;
/** The last `markPhase` label of a boot; later lines belong to a restart. */
const LAST_BOOT_PHASE = /^Server listening\b/;

/**
 * @param {string} rawLine
 * @returns {{ task: string, message: string } | undefined}
 */
export function parseTurboLine(rawLine) {
	const match = TURBO_LINE.exec(stripVTControlCharacters(rawLine).trimEnd());
	const task = match?.groups?.task;
	const message = match?.groups?.message;
	if (task === undefined || message === undefined) {
		return undefined;
	}
	return { task, message: message.trim() };
}

/**
 * @param {string} message
 * @returns {boolean}
 */
export function isRspackCompiledMessage(message) {
	return RSPACK_COMPILED.test(message);
}

/**
 * @param {string} message
 * @returns {{ label: string, stepMs: number, totalMs: number } | undefined}
 */
export function parseMarkPhase(message) {
	const groups = MARK_PHASE.exec(message)?.groups;
	if (groups?.label === undefined || groups.stepMs === undefined || groups.totalMs === undefined) {
		return undefined;
	}
	return { label: groups.label, stepMs: Number(groups.stepMs), totalMs: Number(groups.totalMs) };
}

/**
 * Collects what phase B needs from the stream: the clock reading of the API's
 * FIRST successful rspack build, and every `markPhase` line of the first boot.
 */
export class ApiBootRecorder {
	/** @type {number | undefined} */
	#compiledAt = undefined;
	/** @type {{ label: string, stepMs: number, totalMs: number }[]} */
	#phases = [];
	#bootFinished = false;
	/** @type {() => number} */
	#now;

	/**
	 * @param {() => number} now
	 */
	constructor(now) {
		this.#now = now;
	}

	/**
	 * @param {string} rawLine
	 * @returns {void}
	 */
	accept(rawLine) {
		const line = parseTurboLine(rawLine);
		if (line?.task !== API_DEV_TASK) {
			return;
		}
		if (this.#compiledAt === undefined) {
			if (isRspackCompiledMessage(line.message)) {
				this.#compiledAt = this.#now();
			}
			return;
		}
		const phase = parseMarkPhase(line.message);
		if (phase === undefined || this.#bootFinished) {
			return;
		}
		this.#phases.push(phase);
		this.#bootFinished = LAST_BOOT_PHASE.test(phase.label);
	}

	/** @returns {number | undefined} */
	get compiledAt() {
		return this.#compiledAt;
	}

	/** @returns {readonly { label: string, stepMs: number, totalMs: number }[]} */
	get phases() {
		return this.#phases;
	}
}
