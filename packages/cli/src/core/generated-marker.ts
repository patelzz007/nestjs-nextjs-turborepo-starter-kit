export const GENERATED_BEGIN = "// @app-generated:begin";
export const GENERATED_END = "// @app-generated:end";
export const SQL_GENERATED_BEGIN = "-- @app-generated:begin";
export const SQL_GENERATED_END = "-- @app-generated:end";

export interface GeneratedBlockRange {
	readonly start: number;
	readonly end: number;
	readonly content: string;
}

export interface MarkerPrefixes {
	readonly begin: string;
	readonly end: string;
}

export const TS_MARKER_PREFIXES: MarkerPrefixes = {
	begin: GENERATED_BEGIN,
	end: GENERATED_END,
};

export const SQL_MARKER_PREFIXES: MarkerPrefixes = {
	begin: SQL_GENERATED_BEGIN,
	end: SQL_GENERATED_END,
};

export interface GeneratedBlockOptions {
	readonly prefixes?: MarkerPrefixes;
	readonly linePrefix?: string;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildBeginLinePattern(markerKey: string, prefixes: MarkerPrefixes): RegExp {
	return new RegExp(`^\\s*${escapeRegExp(prefixes.begin)} ${escapeRegExp(markerKey)}\\s*$`, "m");
}

function buildEndLinePattern(markerKey: string, prefixes: MarkerPrefixes): RegExp {
	return new RegExp(`^\\s*${escapeRegExp(prefixes.end)} ${escapeRegExp(markerKey)}\\s*$`, "m");
}

/** Finds all exact generated blocks for a marker key (handles legacy duplicate blocks). */
export function findAllGeneratedBlocks(content: string, markerKey: string, prefixes: MarkerPrefixes = TS_MARKER_PREFIXES): GeneratedBlockRange[] {
	const blocks: GeneratedBlockRange[] = [];
	let offset = 0;
	while (offset < content.length) {
		const remainder = content.slice(offset);
		const beginMatch = buildBeginLinePattern(markerKey, prefixes).exec(remainder);
		if (!beginMatch) {
			break;
		}
		const blockStart = offset + beginMatch.index;
		const afterBegin = blockStart + beginMatch[0].length;
		const endMatch = buildEndLinePattern(markerKey, prefixes).exec(content.slice(afterBegin));
		if (!endMatch) {
			throw new Error(`Malformed generated block for "${markerKey}": missing end marker`);
		}
		const blockEnd = afterBegin + endMatch.index + endMatch[0].length;
		blocks.push({
			start: blockStart,
			end: blockEnd,
			content: content.slice(blockStart, blockEnd),
		});
		offset = blockEnd;
	}
	return blocks;
}

/** Finds an exact generated block by marker key (full-line match, no prefix collisions). */
export function findGeneratedBlock(content: string, markerKey: string, prefixes: MarkerPrefixes = TS_MARKER_PREFIXES): GeneratedBlockRange | null {
	const blocks = findAllGeneratedBlocks(content, markerKey, prefixes);
	return blocks[0] ?? null;
}

/** Returns whether an exact generated block exists for the marker key. */
export function hasGeneratedBlock(content: string, markerKey: string, prefixes: MarkerPrefixes = TS_MARKER_PREFIXES): boolean {
	return findGeneratedBlock(content, markerKey, prefixes) !== null;
}

function wrapGeneratedBlock(markerKey: string, block: string, prefixes: MarkerPrefixes, linePrefix: string): string {
	const trimmedBlock = block.replace(/^\n/, "").replace(/\n$/, "");
	return `${linePrefix}${prefixes.begin} ${markerKey}\n${trimmedBlock}\n${linePrefix}${prefixes.end} ${markerKey}`;
}

/** Replaces an existing generated block or inserts wrapped content at insertIndex. */
export function upsertGeneratedBlock(content: string, markerKey: string, block: string, insertIndex: number, options: GeneratedBlockOptions = {}): string {
	const prefixes = options.prefixes ?? TS_MARKER_PREFIXES;
	const linePrefix = options.linePrefix ?? "";
	const wrapped = wrapGeneratedBlock(markerKey, block, prefixes, linePrefix);
	const existingBlocks = findAllGeneratedBlocks(content, markerKey, prefixes);
	if (existingBlocks.length > 0) {
		let working = content;
		for (let index = existingBlocks.length - 1; index >= 0; index -= 1) {
			const range = existingBlocks[index];
			if (range === undefined) {
				continue;
			}
			working = `${working.slice(0, range.start)}${working.slice(range.end)}`;
		}
		const firstBlock = existingBlocks[0];
		if (firstBlock === undefined) {
			throw new Error(`Malformed generated block for "${markerKey}": missing block range`);
		}
		const insertAt = firstBlock.start;
		return `${working.slice(0, insertAt)}${wrapped}${working.slice(insertAt)}`;
	}
	const prefix = content.slice(0, insertIndex);
	const suffix = content.slice(insertIndex);
	const separator = prefix.endsWith("\n") || prefix.length === 0 ? "" : "\n";
	return `${prefix}${separator}${wrapped}${suffix.startsWith("\n") ? suffix : `\n${suffix}`}`;
}

/** Removes an exact generated block; no-op when absent. */
export function removeGeneratedBlock(content: string, markerKey: string, prefixes: MarkerPrefixes = TS_MARKER_PREFIXES): string {
	let next = content;
	while (hasGeneratedBlock(next, markerKey, prefixes)) {
		const existing = findGeneratedBlock(next, markerKey, prefixes);
		if (existing === null) {
			break;
		}
		next = `${next.slice(0, existing.start)}${next.slice(existing.end)}`;
	}
	next = next.replace(/\n{3,}/g, "\n\n");
	return next;
}

/** Builds begin/end marker strings for a marker key. */
export function buildMarkerPair(markerKey: string, prefixes: MarkerPrefixes = TS_MARKER_PREFIXES): { readonly begin: string; readonly end: string } {
	return {
		begin: `${prefixes.begin} ${markerKey}`,
		end: `${prefixes.end} ${markerKey}`,
	};
}
