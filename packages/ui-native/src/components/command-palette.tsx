// A command palette (ADR 079): a sheet with a search field over grouped commands — the places and
// actions of the app, each a glyph on a tinted tile, a label and an optional line under it. Typing
// narrows the list to the commands whose label or line holds the text (the palette's own list: it
// searches no data). Choosing a command closes the palette, then runs it.
//
// Presentational and controlled: the caller says whether it is open, what closing does, and the
// commands (`groups`); the palette keeps only what is typed, cleared each time it closes.

import ChevronRightIcon from "lucide-react-native/icons/chevron-right";
import SearchIcon from "lucide-react-native/icons/search";
import { cva } from "class-variance-authority";
import * as React from "react";
import { Pressable, Text, View, type ViewInstance } from "react-native";

import { BottomSheet } from "./bottom-sheet";
import { EmptyState } from "./empty";
import { Icon, type LucideIcon } from "./icon";
import { IconTile, type IconTileTone } from "./icon-tile";
import { InputGroup } from "./input-group";
import { ListGroup } from "./list-group";

export interface CommandPaletteItem {
	/** Stable identity of the command. */
	readonly key: string;
	readonly label: string;
	/** A short line under the label ("Password, two-factor, backup codes"). */
	readonly description?: string;
	readonly icon: LucideIcon;
	/** The tint of the glyph's tile (default `neutral`). */
	readonly tone?: IconTileTone;
	/** Runs the command; the palette has already closed. */
	readonly onSelect: () => void;
	readonly testID?: string;
}

export interface CommandPaletteGroup {
	readonly key: string;
	/** Names the group above its commands ("Account"). */
	readonly title: string;
	readonly items: readonly CommandPaletteItem[];
}

export interface CommandPaletteProps {
	readonly visible: boolean;
	readonly onClose: () => void;
	readonly groups: readonly CommandPaletteGroup[];
	/** The sheet's heading and its close button's name. */
	readonly title: string;
	readonly placeholder: string;
	/** Shown when nothing matches what was typed. */
	readonly emptyMessage: string;
	readonly testID?: string;
}

export const commandPaletteRowVariants = cva("min-h-12 flex-row items-center gap-3 py-2.5 active:opacity-70");
export const commandPaletteLabelVariants = cva("font-sans-medium text-base text-foreground");
export const commandPaletteDescriptionVariants = cva("font-sans text-sm text-muted-foreground");

/** Whether a command matches what was typed: its label or its line holds the text, ignoring case and outer spaces. */
export function commandMatches(item: Pick<CommandPaletteItem, "label" | "description">, query: string): boolean {
	const needle = query.trim().toLocaleLowerCase();
	if (needle === "") {
		return true;
	}
	return item.label.toLocaleLowerCase().includes(needle) || (item.description?.toLocaleLowerCase().includes(needle) ?? false);
}

/** The groups with only their matching commands, and no group left empty. */
export function matchingGroups(groups: readonly CommandPaletteGroup[], query: string): CommandPaletteGroup[] {
	return groups
		.map((group: CommandPaletteGroup): CommandPaletteGroup => ({ ...group, items: group.items.filter((item: CommandPaletteItem): boolean => commandMatches(item, query)) }))
		.filter((group: CommandPaletteGroup): boolean => group.items.length > 0);
}

export const CommandPalette = React.memo(
	React.forwardRef<ViewInstance, CommandPaletteProps>(function CommandPalette({ visible, onClose, groups, title, placeholder, emptyMessage, testID }, ref): React.JSX.Element {
		const [query, setQuery] = React.useState("");
		const close = React.useCallback((): void => {
			setQuery("");
			onClose();
		}, [onClose]);
		const shown = matchingGroups(groups, query);
		return (
			<BottomSheet ref={ref} visible={visible} title={title} onClose={close} size="lg" {...(testID === undefined ? {} : { testID })}>
				<View className="gap-5">
					<InputGroup
						leadingIcon={SearchIcon}
						value={query}
						onChange={setQuery}
						placeholder={placeholder}
						accessibilityLabel={placeholder}
						autoCapitalize="none"
						autoCorrect={false}
						returnKeyType="search"
						{...(testID === undefined ? {} : { testID: `${testID}-input` })}
					/>
					{shown.length === 0 ? (
						<EmptyState message={emptyMessage} />
					) : (
						shown.map((group: CommandPaletteGroup): React.JSX.Element => (
							<ListGroup key={group.key} title={group.title}>
								{group.items.map((item: CommandPaletteItem): React.JSX.Element => (
									<CommandRow key={item.key} item={item} onClose={close} />
								))}
							</ListGroup>
						))
					)}
				</View>
			</BottomSheet>
		);
	}),
);

interface CommandRowProps {
	readonly item: CommandPaletteItem;
	readonly onClose: () => void;
}

const CommandRow = React.memo(function CommandRow({ item, onClose }: CommandRowProps): React.JSX.Element {
	const { onSelect } = item;
	const select = React.useCallback((): void => {
		onClose();
		onSelect();
	}, [onClose, onSelect]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={item.description === undefined ? item.label : `${item.label}, ${item.description}`}
			onPress={select}
			className={commandPaletteRowVariants()}
			{...(item.testID === undefined ? {} : { testID: item.testID })}>
			<IconTile icon={item.icon} tone={item.tone ?? "neutral"} size="sm" />
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
			<Icon icon={ChevronRightIcon} size="sm" colorClassName="accent-muted-foreground" />
		</Pressable>
	);
});
