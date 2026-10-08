/**
 * Ordinal names for 0-based list positions (rules/27-array-index-readability.md).
 *
 * Each slot is typed as its literal index (`first: 0`), so indexing a tuple keeps the
 * element type of that exact position: `pair[LIST_SLOT_INDEX.second]` on a
 * `[number, Buffer]` is a `Buffer`, exactly like `pair[1]`.
 */
export interface ListSlotIndex {
	readonly first: 0;
	readonly second: 1;
	readonly third: 2;
	readonly fourth: 3;
	readonly fifth: 4;
	readonly sixth: 5;
	readonly seventh: 6;
	readonly eighth: 7;
	readonly ninth: 8;
	readonly tenth: 9;
}

export type ListSlotKey = keyof ListSlotIndex;

/** Named list positions — `items[LIST_SLOT_INDEX.first]`. Prefer a domain index map when "first" says too little. */
export const LIST_SLOT_INDEX: ListSlotIndex = {
	first: 0,
	second: 1,
	third: 2,
	fourth: 3,
	fifth: 4,
	sixth: 5,
	seventh: 6,
	eighth: 7,
	ninth: 8,
	tenth: 9,
};
