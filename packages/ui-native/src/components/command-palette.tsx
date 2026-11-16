// A command palette (ADR 079): a search field over grouped commands — the places and actions of
// the app, each with a glyph on a tinted tile (or an avatar, a file icon), a label, an optional
// line under it, and an optional badge or keyboard shortcut after it. Typing narrows the list to the
// commands whose label, line or keywords hold the text (the palette's own list: it searches no
// data). `CommandList` is the list itself, always open on a screen or a card; `CommandPalette` is
// the list in a sheet, which closes before the chosen command runs.
//
// Presentational and controlled: the caller says whether the palette is open, what closing does,
// and the commands (`groups`); the list keeps only what is typed, cleared each time it closes.

import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import SearchIcon from "lucide-react-native/icons/search";
import { cva } from "class-variance-authority";
import * as React from "react";
import { Pressable, Text, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import { BottomSheet } from "./bottom-sheet";
import { EmptyState } from "./empty";
import { Icon, type LucideIcon } from "./icon";
import { IconTile, type IconTileTone } from "./icon-tile";
import { InputGroup } from "./input-group";
import { KbdGroup } from "./kbd";
import { ListGroup } from "./list-group";

export interface CommandPaletteItem {
	/** Stable identity of the command. */
	readonly key: string;
	readonly label: string;
	/** A short line under the label ("Password, two-factor, backup codes"). */
	readonly description?: string | undefined;
	/** A glyph on a tinted tile. */
	readonly icon?: LucideIcon | undefined;
	/** The tint of the glyph's tile (default `neutral`). */
	readonly tone?: IconTileTone | undefined;
	/** In place of the glyph: an avatar, a file icon, a logo. Decorative. */
	readonly leading?: React.ReactNode;
	/** After the label: a badge, a time. Decorative: say it in `description` too when it matters. */
	readonly trailing?: React.ReactNode;
	/** The command's keyboard shortcut ("⌘", "K"), shown as key caps. */
	readonly shortcut?: readonly string[] | undefined;
	/** More words that find it ("preferences" for Settings). */
	readonly keywords?: readonly string[] | undefined;
	/** The command cannot run now. */
	readonly disabled?: boolean | undefined;
	/** Runs the command; a palette has already closed. */
	readonly onSelect: () => void;
	readonly testID?: string | undefined;
}

export interface CommandPaletteGroup {
	readonly key: string;
	/** Names the group above its commands ("Account"). */
	readonly title: string;
	readonly items: readonly CommandPaletteItem[];
}

export const commandPaletteRowVariants = cva("min-h-12 flex-row items-center gap-3 py-2.5", {
	variants: {
		state: { default: "active:opacity-70", disabled: "opacity-50" },
	},
	defaultVariants: { state: "default" },
});
export const commandPaletteLabelVariants = cva("font-sans-medium text-body-lg text-foreground");
export const commandPaletteDescriptionVariants = cva("text-body font-sans text-muted-foreground");

/** Whether a command matches what was typed: its label, its line or a keyword holds the text, ignoring case and outer spaces. */
export function commandMatches(item: Pick<CommandPaletteItem, "label" | "description" | "keywords">, query: string): boolean {
	const needle = query.trim().toLocaleLowerCase();
	if (needle === "") {
		return true;
	}
	return [item.label, item.description ?? "", ...(item.keywords ?? [])].some((text: string): boolean => text.toLocaleLowerCase().includes(needle));
}

/** The groups with only their matching commands, and no group left empty. */
export function matchingGroups(groups: readonly CommandPaletteGroup[], query: string): CommandPaletteGroup[] {
	return groups
		.map((group: CommandPaletteGroup): CommandPaletteGroup => ({ ...group, items: group.items.filter((item: CommandPaletteItem): boolean => commandMatches(item, query)) }))
		.filter((group: CommandPaletteGroup): boolean => group.items.length > 0);
}

export const commandListVariants = cva("gap-5", {
	variants: {
		variant: { plain: "", card: "rounded-card border border-border bg-card p-3" },
	},
	defaultVariants: { variant: "plain" },
});

export type CommandListVariant = "plain" | "card";

export interface CommandListProps {
	readonly groups: readonly CommandPaletteGroup[];
	readonly placeholder: string;
	/** Shown when nothing matches what was typed. */
	readonly emptyMessage: string;
	/** Before a chosen command runs (a palette closes itself here). */
	readonly onBeforeSelect?: (() => void) | undefined;
	/** The search text: the caller's, with `onQueryChange`. */
	readonly query?: string | undefined;
	readonly onQueryChange?: ((query: string) => void) | undefined;
	/** Focus the search as the list appears (in a palette). */
	readonly autoFocus?: boolean | undefined;
	/** A chevron at the end of each row that has no shortcut or trailing part (the palette's look). */
	readonly showChevrons?: boolean | undefined;
	readonly variant?: CommandListVariant | undefined;
	/** Extra classes for the root view, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

/** The search and the grouped commands, always open: on a screen, a card, or in the palette's sheet. */
export const CommandList = React.memo(
	React.forwardRef<ViewInstance, CommandListProps>(function CommandList(
		{ groups, placeholder, emptyMessage, onBeforeSelect, query: shownQuery, onQueryChange, autoFocus = false, showChevrons = false, variant = "plain", className, testID },
		ref,
	): React.JSX.Element {
		const [ownQuery, setOwnQuery] = React.useState("");
		const query = shownQuery ?? ownQuery;
		const changeQuery = React.useCallback(
			(next: string): void => {
				setOwnQuery(next);
				onQueryChange?.(next);
			},
			[onQueryChange],
		);
		const shown = matchingGroups(groups, query);
		return (
			<View ref={ref} testID={testID} className={cn(commandListVariants({ variant }), className)}>
				<InputGroup
					leadingIcon={SearchIcon}
					value={query}
					onChange={changeQuery}
					placeholder={placeholder}
					accessibilityLabel={placeholder}
					autoCapitalize="none"
					autoCorrect={false}
					autoFocus={autoFocus}
					returnKeyType="search"
					testID={testID === undefined ? undefined : `${testID}-input`}
				/>
				{shown.length === 0 ? (
					<EmptyState message={emptyMessage} />
				) : (
					shown.map((group: CommandPaletteGroup): React.JSX.Element => (
						<ListGroup key={group.key} title={group.title}>
							{group.items.map((item: CommandPaletteItem): React.JSX.Element => (
								<CommandRow key={item.key} item={item} onBeforeSelect={onBeforeSelect} showChevron={showChevrons} />
							))}
						</ListGroup>
					))
				)}
			</View>
		);
	}),
);

export interface CommandPaletteProps {
	readonly visible: boolean;
	readonly onClose: () => void;
	readonly groups: readonly CommandPaletteGroup[];
	/** The sheet's heading and its close button's name. */
	readonly title: string;
	readonly placeholder: string;
	/** Shown when nothing matches what was typed. */
	readonly emptyMessage: string;
	readonly testID?: string | undefined;
}

export const CommandPalette = React.memo(
	React.forwardRef<ViewInstance, CommandPaletteProps>(function CommandPalette({ visible, onClose, groups, title, placeholder, emptyMessage, testID }, ref): React.JSX.Element {
		const [query, setQuery] = React.useState("");
		const close = React.useCallback((): void => {
			setQuery("");
			onClose();
		}, [onClose]);
		return (
			<BottomSheet ref={ref} visible={visible} title={title} onClose={close} size="lg" testID={testID}>
				<CommandList
					groups={groups}
					placeholder={placeholder}
					emptyMessage={emptyMessage}
					query={query}
					onQueryChange={setQuery}
					onBeforeSelect={close}
					showChevrons
					testID={testID === undefined ? undefined : `${testID}-list`}
				/>
			</BottomSheet>
		);
	}),
);

interface CommandRowProps {
	readonly item: CommandPaletteItem;
	readonly onBeforeSelect: (() => void) | undefined;
	readonly showChevron: boolean;
}

const CommandRow = React.memo(function CommandRow({ item, onBeforeSelect, showChevron }: CommandRowProps): React.JSX.Element {
	const { onSelect, disabled = false } = item;
	const select = React.useCallback((): void => {
		onBeforeSelect?.();
		onSelect();
	}, [onBeforeSelect, onSelect]);
	const accessibilityState = React.useMemo(() => ({ disabled }), [disabled]);
	const hasEnd = item.shortcut !== undefined || item.trailing !== undefined;
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={item.description === undefined ? item.label : `${item.label}, ${item.description}`}
			accessibilityState={accessibilityState}
			disabled={disabled}
			onPress={select}
			className={commandPaletteRowVariants({ state: disabled ? "disabled" : "default" })}
			testID={item.testID}>
			{item.icon === undefined ? item.leading : <IconTile icon={item.icon} tone={item.tone ?? "neutral"} size="sm" />}
			<View className="flex-1 gap-0.5">
				<Text numberOfLines={1} className={commandPaletteLabelVariants()}>
					{item.label}
				</Text>
				{item.description === undefined ? null : (
					<Text numberOfLines={1} className={commandPaletteDescriptionVariants()}>
						{item.description}
					</Text>
				)}
			</View>
			{item.trailing === undefined ? null : <View importantForAccessibility="no-hide-descendants">{item.trailing}</View>}
			{item.shortcut === undefined ? null : <KbdGroup keys={item.shortcut} />}
			{showChevron && !hasEnd ? <Icon icon={ChevronRightIcon} size="sm" colorClassName="accent-icon" /> : null}
		</Pressable>
	);
});
