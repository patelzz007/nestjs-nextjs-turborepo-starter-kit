// ============================================
// lib/command/command-store.ts — one command list's state
// ============================================
// A tiny external store (read with `useSyncExternalStore`) behind each
// `CommandPrimitive.Root`: the search text, the highlighted value, the
// registered items and the filter options. Items and groups subscribe to the
// one boolean they render, so typing re-renders only the rows that appear or
// disappear. Framework-free and pure apart from its listeners.

import { defaultCommandFilter, type CommandFilter } from "@workspace/ui/lib/command/command-filter";

/** What an item registers: the text it is matched and selected by. */
export interface CommandItemRecord {
	readonly value: string;
	readonly keywords: readonly string[];
	/** The group it sits in, if any — a group hides when none of its items match. */
	readonly groupId: string | undefined;
	/** Shown whatever the search (`forceMount`). */
	readonly alwaysVisible: boolean;
}

export interface CommandFilterOptions {
	/** `false` leaves filtering to the caller (every item stays visible). */
	readonly shouldFilter: boolean;
	readonly filter: CommandFilter;
}

export interface CommandStore {
	readonly subscribe: (listener: () => void) => () => void;
	readonly getSearch: () => string;
	readonly setSearch: (search: string) => void;
	readonly getSelectedValue: () => string;
	readonly setSelectedValue: (value: string) => void;
	readonly setOptions: (options: CommandFilterOptions) => void;
	/** Adds or updates an item (no-op when nothing changed). */
	readonly upsert: (id: string, record: CommandItemRecord) => void;
	readonly remove: (id: string) => void;
	/** Bumped whenever the set of items changes — a dependency for "is the highlight still there?". */
	readonly getVersion: () => number;
	readonly isItemVisible: (id: string) => boolean;
	readonly isGroupVisible: (groupId: string) => boolean;
	/** How many registered items are visible (the empty state shows at 0). */
	readonly getVisibleCount: () => number;
	/** The DOM id of the item holding `value`, for `aria-activedescendant`. */
	readonly getItemIdByValue: (value: string) => string | undefined;
}

function isSameRecord(left: CommandItemRecord, right: CommandItemRecord): boolean {
	return (
		left.value === right.value &&
		left.groupId === right.groupId &&
		left.alwaysVisible === right.alwaysVisible &&
		left.keywords.length === right.keywords.length &&
		left.keywords.every((keyword: string, index: number): boolean => keyword === right.keywords.at(index))
	);
}

const DEFAULT_OPTIONS: CommandFilterOptions = { shouldFilter: true, filter: defaultCommandFilter };

export function createCommandStore(initialSelectedValue = ""): CommandStore {
	const listeners = new Set<() => void>();
	const items = new Map<string, CommandItemRecord>();
	let search = "";
	let selectedValue = initialSelectedValue;
	let options = DEFAULT_OPTIONS;
	let version = 0;
	// Derived on every change, read many times per render.
	let visibleIds = new Set<string>();
	let visibleGroups = new Set<string>();
	let registeredGroups = new Set<string>();

	const matches = (record: CommandItemRecord): boolean =>
		record.alwaysVisible || !options.shouldFilter || search.trim() === "" || options.filter(record.value, search, record.keywords) > 0;

	const recompute = (): void => {
		const nextVisible = new Set<string>();
		const nextGroups = new Set<string>();
		const nextRegisteredGroups = new Set<string>();
		for (const [id, record] of items) {
			if (record.groupId !== undefined) {
				nextRegisteredGroups.add(record.groupId);
			}
			if (matches(record)) {
				nextVisible.add(id);
				if (record.groupId !== undefined) {
					nextGroups.add(record.groupId);
				}
			}
		}
		visibleIds = nextVisible;
		visibleGroups = nextGroups;
		registeredGroups = nextRegisteredGroups;
	};

	const emit = (): void => {
		recompute();
		for (const listener of listeners) {
			listener();
		}
	};

	return {
		subscribe: (listener: () => void): (() => void) => {
			listeners.add(listener);
			return (): void => {
				listeners.delete(listener);
			};
		},
		getSearch: (): string => search,
		setSearch: (next: string): void => {
			if (next !== search) {
				search = next;
				emit();
			}
		},
		getSelectedValue: (): string => selectedValue,
		setSelectedValue: (next: string): void => {
			if (next !== selectedValue) {
				selectedValue = next;
				emit();
			}
		},
		setOptions: (next: CommandFilterOptions): void => {
			if (next.shouldFilter !== options.shouldFilter || next.filter !== options.filter) {
				options = next;
				emit();
			}
		},
		upsert: (id: string, record: CommandItemRecord): void => {
			const current = items.get(id);
			if (current !== undefined && isSameRecord(current, record)) {
				return;
			}
			items.set(id, record);
			version += 1;
			emit();
		},
		remove: (id: string): void => {
			if (items.delete(id)) {
				version += 1;
				emit();
			}
		},
		getVersion: (): number => version,
		// An item not registered yet (its first render) is shown, so nothing flickers in.
		isItemVisible: (id: string): boolean => !items.has(id) || visibleIds.has(id),
		// A group with no registered items yet is shown for the same reason.
		isGroupVisible: (groupId: string): boolean => !registeredGroups.has(groupId) || visibleGroups.has(groupId),
		getVisibleCount: (): number => visibleIds.size,
		getItemIdByValue: (value: string): string | undefined => {
			for (const [id, record] of items) {
				if (record.value === value && visibleIds.has(id)) {
					return id;
				}
			}
			return undefined;
		},
	};
}
