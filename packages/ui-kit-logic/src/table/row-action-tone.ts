// The colour of a row action's icon tile, shared by the web and native tables: each entry of a row's ⋯ menu sits on
// a coloured tile, so the entries are told apart at a glance. The hues are the tone palette's (`tone-*` tokens, each
// text on its own soft fill, AA in both themes); `destructive` is for an action that removes or cannot be undone.

/** A row action's tile colour. */
export type DataTableRowActionTone = "blue" | "violet" | "teal" | "green" | "orange" | "yellow" | "destructive";

/** The hues an entry without a tone takes, in menu order, so neighbouring entries differ. */
export const DATA_TABLE_ROW_ACTION_DEFAULT_TONES: readonly DataTableRowActionTone[] = ["blue", "violet", "teal", "green", "orange"];

/** The first default hue, for when the cycle is somehow empty. */
const FALLBACK_TONE: DataTableRowActionTone = "blue";

/** An entry's tone: its own, else the next hue of the default cycle by its place in the menu (cycling past the end). */
export function resolveDataTableRowActionTone(tone: DataTableRowActionTone | undefined, position: number): DataTableRowActionTone {
	return tone ?? DATA_TABLE_ROW_ACTION_DEFAULT_TONES[position % DATA_TABLE_ROW_ACTION_DEFAULT_TONES.length] ?? FALLBACK_TONE;
}
