import { WeakValueCache } from "@workspace/shared";
import type { BundledLanguage, BundledTheme, Highlighter } from "shiki";

const HIGHLIGHTER_CACHE_KEY = "default";

export interface ShikiHighlighterConfig {
	readonly theme: BundledTheme;
	readonly langs: readonly BundledLanguage[];
}

const highlighterCache = new WeakValueCache<string, Highlighter>();
let highlighterPromise: Promise<Highlighter> | undefined;

/**
 * Returns a shared Shiki highlighter. The in-flight creation promise is held
 * strongly; only the resolved highlighter is stored in a weak-value cache.
 */
export function getSharedHighlighter(config: ShikiHighlighterConfig): Promise<Highlighter> {
	const cached = highlighterCache.get(HIGHLIGHTER_CACHE_KEY);
	if (cached !== undefined) {
		return Promise.resolve(cached);
	}

	highlighterPromise ??= createHighlighter(config).finally((): void => {
		highlighterPromise = undefined;
	});

	return highlighterPromise;
}

async function createHighlighter(config: ShikiHighlighterConfig): Promise<Highlighter> {
	try {
		const { createHighlighter: create } = await import("shiki");
		const highlighter = await create({
			themes: [config.theme],
			langs: [...new Set(config.langs)],
		});
		highlighterCache.set(HIGHLIGHTER_CACHE_KEY, highlighter);
		return highlighter;
	} catch (error) {
		highlighterPromise = undefined;
		throw error;
	}
}

/** Test helper — clears the weak cache and in-flight promise. */
export function resetSharedHighlighterForTests(): void {
	highlighterCache.clear();
	highlighterPromise = undefined;
}

/** Test helper — exposes whether a highlighter is currently cached. */
export function getCachedHighlighterForTests(): Highlighter | undefined {
	return highlighterCache.get(HIGHLIGHTER_CACHE_KEY);
}

/** Test helper — number of weak cache slots (not whether values are alive). */
export function getHighlighterCacheSizeForTests(): number {
	return highlighterCache.size;
}
