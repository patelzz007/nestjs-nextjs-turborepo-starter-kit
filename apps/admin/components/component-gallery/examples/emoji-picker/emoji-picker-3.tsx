"use client";

import * as React from "react";
import { SmilePlusIcon } from "lucide-react";
import {
	EmojiPicker,
	EmojiPickerCategories,
	EmojiPickerContent,
	EmojiPickerFooter,
	EmojiPickerHeader,
	EmojiPickerList,
	EmojiPickerPreview,
	EmojiPickerSearch,
	EmojiPickerSkinTone,
	EmojiPickerTrigger,
	EmojiPickerValue,
	findEmoji,
	getEmojiValue,
	useEmojiPicker,
	type EmojiPickerEmoji,
	type EmojiPickerSelection,
	type EmojiPickerSkinTone as SkinTone,
} from "@workspace/ui/components/emoji-picker";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@workspace/ui/components/item";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useUiKitLabels } from "@workspace/ui/components/ui-kit-labels-provider";

interface Reaction {
	/** The toned value, so each skin tone gets a pill of its own. */
	readonly emoji: string;
	readonly label: string;
	/** Everyone else who reacted, in the order they did. */
	readonly people: readonly string[];
	readonly mine: boolean;
}

/** The skin tone names, in tone order (0 is the default yellow). */
type SkinToneNames = readonly [string, string, string, string, string, string];

const INITIAL_REACTIONS: readonly Reaction[] = [
	{
		emoji: "🎉",
		label: "party popper",
		people: ["Amara Okafor", "Priya Shah"],
		mine: true,
	},
	{
		emoji: "🚀",
		label: "rocket",
		people: ["Daniel Kim", "Michael Rodriguez", "Priya Shah"],
		mine: false,
	},
	{
		emoji: "👍🏽",
		label: "thumbs up, medium skin tone",
		people: ["Michael Rodriguez", "Amara Okafor"],
		mine: false,
	},
	{ emoji: "👀", label: "eyes", people: ["Daniel Kim"], mine: false },
];

/* Untoned on purpose: the row draws them in the tone picked in the footer,
   so a toned 👍 joins the matching pill instead of starting a new one. */
const QUICK_REACTIONS: readonly string[] = ["👍", "❤️", "😂", "🎉", "🙏", "👀"];

/** Tone 0 is the untoned default yellow, which the name leaves out. */
const DEFAULT_SKIN_TONE: SkinTone = 0;

/* The tone goes into the name, or two pills of one emoji would announce
   the same thing. The tone names come from the kit's label pack, so they
   follow the app's language. */
function labelOf(emoji: EmojiPickerEmoji, tone: SkinTone, toneNames: SkinToneNames): string {
	return tone !== DEFAULT_SKIN_TONE && emoji.skins !== undefined ? `${emoji.label}, ${toneNames[tone].toLowerCase()} skin tone` : emoji.label;
}

function countOf(reaction: Reaction): number {
	return reaction.people.length + (reaction.mine ? 1 : 0);
}

/* "Amara Okafor, Priya Shah and you": you always come last. */
function namesOf(reaction: Reaction): string {
	const names = reaction.mine ? [...reaction.people, "you"] : reaction.people;
	const last = names.at(-1) ?? "";
	if (names.length === 1) return reaction.mine ? "You" : last;
	return `${names.slice(0, -1).join(", ")} and ${last}`;
}

interface QuickReactionButtonProps {
	readonly glyph: string;
	readonly reactions: readonly Reaction[];
	readonly toneNames: SkinToneNames;
}

/* One quick reaction. Undefined emoji until the data arrives, which the
   trigger starts fetching on hover, so the button is rarely disabled for long. */
function QuickReactionButton({ glyph, reactions, toneNames }: QuickReactionButtonProps): React.JSX.Element {
	const { emojis, skinTone, select } = useEmojiPicker();
	const emoji = findEmoji(emojis, glyph);
	const value = emoji === undefined ? glyph : getEmojiValue(emoji, skinTone);
	const mine = reactions.some((reaction) => reaction.mine && reaction.emoji === value);
	const handleClick = React.useCallback((): void => {
		if (emoji !== undefined) select(emoji);
	}, [emoji, select]);
	return (
		/* Pressed reads as a quiet fill, not a solid primary tile. */
		<Button
			variant={mine ? "secondary" : "ghost"}
			size="icon-sm"
			aria-pressed={mine}
			aria-label={emoji === undefined ? glyph : labelOf(emoji, skinTone, toneNames)}
			disabled={emoji === undefined}
			onClick={handleClick}>
			<span aria-hidden="true" className="text-(length:--emoji-picker-emoji) leading-none">
				<EmojiPickerValue value={value} />
			</span>
		</Button>
	);
}

interface QuickReactionsProps {
	readonly reactions: readonly Reaction[];
	readonly toneNames: SkinToneNames;
}

/* A composed first row in the popover, so the common reactions take one
   click. It goes through the picker's own `select`, so the skin tone, the
   recent list and closing on pick behave exactly like a grid pick. Columns
   one cell wide from the grid's gutter put each glyph over a grid column. */
function QuickReactions({ reactions, toneNames }: QuickReactionsProps): React.JSX.Element {
	return (
		<div
			role="group"
			aria-label="Quick reactions"
			className="grid auto-cols-(--emoji-picker-cell) grid-flow-col justify-start justify-items-center px-(--emoji-picker-gutter) pt-(--emoji-picker-padding)">
			{QUICK_REACTIONS.map((glyph): React.JSX.Element => (
				<QuickReactionButton key={glyph} glyph={glyph} reactions={reactions} toneNames={toneNames} />
			))}
		</div>
	);
}

interface ReactionPillProps {
	readonly reaction: Reaction;
	/** The id of the hidden description that names everyone who reacted. */
	readonly descriptionId: string;
	readonly onToggle: (emoji: string, label: string) => void;
}

/* Yours are solid, everyone else's muted. */
function ReactionPill({ reaction, descriptionId, onToggle }: ReactionPillProps): React.JSX.Element {
	const count = countOf(reaction);
	const handleClick = React.useCallback((): void => {
		onToggle(reaction.emoji, reaction.label);
	}, [onToggle, reaction.emoji, reaction.label]);
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						variant={reaction.mine ? "default" : "secondary"}
						size="sm"
						aria-pressed={reaction.mine}
						aria-label={`${reaction.label}, ${String(count)} ${count === 1 ? "reaction" : "reactions"}`}
						aria-describedby={descriptionId}
						onClick={handleClick}
					/>
				}>
				<span aria-hidden="true" className="text-sm leading-none">
					{reaction.emoji}
				</span>
				<span aria-hidden="true" className="tabular-nums">
					{count}
				</span>
				{/* Base UI keeps tooltip text from screen readers, so
				    the names reach them through this instead. */}
				<span id={descriptionId} hidden>
					{namesOf(reaction)} reacted with {reaction.label}
				</span>
			</TooltipTrigger>
			<TooltipContent>{namesOf(reaction)}</TooltipContent>
		</Tooltip>
	);
}

/** How far past the card's bottom edge the panel opens, so it reads as its own surface. */
const PANEL_SIDE_OFFSET_PX = 20;

export function EmojiPicker3Example(): React.JSX.Element {
	const id = React.useId();
	const { skinTones } = useUiKitLabels("emojiPicker");
	const [reactions, setReactions] = React.useState<readonly Reaction[]>(INITIAL_REACTIONS);
	const [announcement, setAnnouncement] = React.useState("");
	const triggerRef = React.useRef<HTMLButtonElement>(null);

	/* One path for a pill, a quick reaction and a grid pick: reacting with
	   an emoji you already used takes yours back, and a pill nobody is left
	   on goes away. */
	const toggle = React.useCallback(
		(emoji: string, label: string): void => {
			const existing = reactions.find((reaction) => reaction.emoji === emoji);
			const mine = existing?.mine !== true;
			const next =
				existing === undefined
					? [...reactions, { emoji, label, people: [], mine }]
					: reactions.map((reaction) => (reaction.emoji === emoji ? { ...reaction, mine } : reaction));
			const kept = next.filter((reaction) => countOf(reaction) > 0);
			setReactions(kept);
			setAnnouncement(mine ? `You reacted with ${label}` : `Removed your ${label} reaction`);
			/* The pressed pill unmounts with its last reaction, and focus would
			   fall to the page; the add button sits beside the row. */
			if (kept.length < next.length) triggerRef.current?.focus();
		},
		[reactions],
	);

	const handleEmojiSelect = React.useCallback(
		({ value, emoji, skinTone }: EmojiPickerSelection): void => {
			toggle(value, labelOf(emoji, skinTone, skinTones));
		},
		[skinTones, toggle],
	);

	return (
		<Item variant="outline" className="max-w-md">
			{/* Top-aligned to the author line; an Item centres its media unless
			    the row has an ItemDescription. */}
			<ItemMedia className="self-start">
				<Avatar>
					<AvatarImage src="https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=96&h=96&dpr=2&q=80" alt="" />
					<AvatarFallback>LM</AvatarFallback>
				</Avatar>
			</ItemMedia>
			<ItemContent>
				<ItemTitle>
					Lucas Martin
					<span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-muted-foreground/40" />
					<span className="font-normal text-muted-foreground">10:42 AM</span>
				</ItemTitle>
				<p className="text-pretty">Dark mode is live for 10% of workspaces. If error rates hold, everyone gets it on Thursday.</p>
				<TooltipProvider>
					<div className="flex flex-wrap items-center gap-1.5 pt-2">
						{/* Keyed by the emoji, not the index, so a description never
						    moves to a neighbour when a pill above it goes away. */}
						{reactions.map((reaction): React.JSX.Element => (
							<ReactionPill key={reaction.emoji} reaction={reaction} descriptionId={`${id}-${reaction.emoji}`} onToggle={toggle} />
						))}
						{/* Controlled to null so the trigger keeps its icon instead of
						    showing the last pick as a value. */}
						<EmojiPicker value={null} aria-label="Add reaction" onEmojiSelect={handleEmojiSelect}>
							<EmojiPickerTrigger ref={triggerRef} variant="secondary" size="icon-sm" title="Add reaction">
								<SmilePlusIcon aria-hidden="true" />
							</EmojiPickerTrigger>
							<EmojiPickerContent side="bottom" align="end" sideOffset={PANEL_SIDE_OFFSET_PX}>
								<QuickReactions reactions={reactions} toneNames={skinTones} />
								<EmojiPickerHeader>
									<EmojiPickerSearch />
								</EmojiPickerHeader>
								<EmojiPickerCategories />
								<EmojiPickerList />
								<EmojiPickerFooter>
									<EmojiPickerPreview />
									<EmojiPickerSkinTone />
								</EmojiPickerFooter>
							</EmojiPickerContent>
						</EmojiPicker>
					</div>
				</TooltipProvider>
				<p role="status" className="sr-only">
					{announcement}
				</p>
			</ItemContent>
		</Item>
	);
}
