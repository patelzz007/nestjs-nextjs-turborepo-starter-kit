"use client";

import * as React from "react";
import { SendIcon } from "lucide-react";
import {
	EMOJI_PICKER_CATEGORIES,
	EmojiPicker,
	EmojiPickerContent,
	EmojiPickerTrigger,
	type EmojiPickerCustomCategory,
	type EmojiPickerCustomEmoji,
	type EmojiPickerSelection,
} from "@workspace/ui/components/emoji-picker";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@workspace/ui/components/item";
import { Separator } from "@workspace/ui/components/separator";
import Image from "next/image";

/* Inline SVG so the example ships no image files. In an app these are the
   workspace's uploads, and any image URL works as `src`. One font size keeps
   one cap height; 4-letter labels are fitted to 44 of the 64 units, so a
   wider system font (Segoe UI, Roboto) cannot push them into the corners.
   The tile colours are the artwork of each custom emoji (an uploaded image in
   a real workspace), not theme chrome, so they are not design tokens. */
/** The default label size, in the tile's 64-unit viewBox. */
const GLYPH_FONT_SIZE = 18;
/** The tile's vertical centre, in viewBox units. */
const GLYPH_CENTRE = 32;
/** Drops the baseline so the cap height, not the baseline, sits on the centre. */
const GLYPH_BASELINE_RATIO = 0.35;
/** Labels this long are squeezed to fit the tile. */
const GLYPH_FITTED_LENGTH = 4;
/** The rendered size of a custom emoji, in CSS pixels. */
const CUSTOM_ICON_PX = 16;
const INLINE_EMOJI_PX = 20;
/** The workspace logo's letter, set larger than the tiles' labels. */
const LOGO_FONT_SIZE = 40;

function glyph(text: string, color: string, size: number = GLYPH_FONT_SIZE): string {
	const baseline = String(GLYPH_CENTRE + size * GLYPH_BASELINE_RATIO);
	const fit = text.length >= GLYPH_FITTED_LENGTH ? ' textLength="44" lengthAdjust="spacingAndGlyphs"' : "";
	return `data:image/svg+xml,${encodeURIComponent(
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${color}"/><text x="32" y="${baseline}" font-family="system-ui,sans-serif" font-size="${String(size)}" font-weight="800" letter-spacing="-0.5" fill="#fff" text-anchor="middle"${fit}>${text}</text></svg>`,
	)}`;
}

/* Emoji whose `category` matches a `customCategories` id get their own tab,
   named by its label. The workspace logo replaces the default sparkle, the
   way Discord marks each server's set. */
const WORKSPACE: EmojiPickerCustomCategory = {
	id: "northwind",
	label: "Northwind Labs",
	icon: <Image src={glyph("N", "#4f46e5", LOGO_FONT_SIZE)} alt="" width={CUSTOM_ICON_PX} height={CUSTOM_ICON_PX} className="size-4" />,
};

/* The team's set leads, ahead of Frequently used, so it opens first however
   much the picker has been used. */
const CATEGORIES: readonly string[] = [WORKSPACE.id, "recent", ...EMOJI_PICKER_CATEGORIES];
const CUSTOM_CATEGORIES: readonly EmojiPickerCustomCategory[] = [WORKSPACE];

/* Two full rows of the default 8 columns, so the set opens as a block of its
   own above Smileys. The id doubles as the shortcode: `:lgtm:`. Where the
   tile prints another word, that word is a second shortcode, so it ties the
   native emoji of that name and the team's set, listed first, wins; a tag
   ranks below a name match. Only the id is stored and rendered, so a typed
   `:ship:` stays text and `:+1:` (a tag) stays the thumbs up. */
const TEAM_EMOJI: readonly EmojiPickerCustomEmoji[] = [
	{ id: "lgtm", label: "Looks good to me", src: glyph("LGTM", "#16a34a") },
	{
		id: "shipit",
		label: "Ship it",
		src: glyph("SHIP", "#7c3aed"),
		shortcodes: ["shipit", "ship"],
	},
	{
		id: "plusone",
		label: "Plus one",
		src: glyph("+1", "#2563eb"),
		tags: ["+1", "agree", "yes"],
	},
	{ id: "wip", label: "Work in progress", src: glyph("WIP", "#d97706") },
	{
		id: "blocked",
		label: "Blocked",
		src: glyph("STOP", "#dc2626"),
		shortcodes: ["blocked", "stop"],
	},
	{
		id: "ty",
		label: "Thank you",
		src: glyph("TY", "#db2777"),
		tags: ["thanks"],
	},
	{ id: "ack", label: "Acknowledged", src: glyph("ACK", "#475569") },
	{
		id: "hotfix",
		label: "Hotfix",
		src: glyph("FIX", "#ea580c"),
		shortcodes: ["hotfix", "fix"],
	},
	{ id: "nit", label: "Nitpick", src: glyph("NIT", "#0891b2") },
	{ id: "sync", label: "Let's sync", src: glyph("SYNC", "#65a30d") },
	{
		id: "revert",
		label: "Revert",
		src: glyph("UNDO", "#c026d3"),
		shortcodes: ["revert", "undo"],
	},
	{
		id: "live",
		label: "Live in production",
		src: glyph("LIVE", "#0284c7"),
		tags: ["deployed"],
	},
	{ id: "brb", label: "Be right back", src: glyph("BRB", "#ca8a04") },
	{
		id: "looking",
		label: "Taking a look",
		src: glyph("LOOK", "#0d9488"),
		shortcodes: ["looking", "look"],
		tags: ["eyes"],
	},
	{ id: "help", label: "Need a hand", src: glyph("HELP", "#e11d48") },
	{ id: "qa", label: "Ready for QA", src: glyph("QA", "#9333ea") },
].map((emoji): EmojiPickerCustomEmoji => ({ ...emoji, category: WORKSPACE.id }));

const BY_CODE: ReadonlyMap<string, EmojiPickerCustomEmoji> = new Map(TEAM_EMOJI.map((emoji): [string, EmojiPickerCustomEmoji] => [`:${emoji.id}:`, emoji]));

/** One `:shortcode:` token, named so the match reads by name. */
const SHORTCODE_PATTERN = /(?<code>:[a-z0-9_+-]+:)/g;

interface TextSegment {
	/** The segment's character offset in the text: unique and stable for one text. */
	readonly offset: number;
	readonly text: string;
}

/** Splits a message into plain runs and `:shortcode:` tokens, in order. */
function segmentText(text: string): readonly TextSegment[] {
	const segments: TextSegment[] = [];
	const pattern = new RegExp(SHORTCODE_PATTERN);
	let cursor = 0;
	for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
		const code = match.groups?.code ?? "";
		if (match.index > cursor) segments.push({ offset: cursor, text: text.slice(cursor, match.index) });
		segments.push({ offset: match.index, text: code });
		cursor = match.index + code.length;
	}
	if (cursor < text.length) segments.push({ offset: cursor, text: text.slice(cursor) });
	return segments;
}

/* Custom emoji travel as `:shortcode:` in the stored text and become images
   on render, the way Slack and Discord keep them. `h-lh` fills the line
   box each style sets (20px on nova, 16px on lyra) and the width follows
   the square intrinsic size, so the line keeps its height. */
function renderText(text: string): React.ReactNode[] {
	return segmentText(text).map((segment): React.ReactNode => {
		const emoji = BY_CODE.get(segment.text);
		return emoji === undefined ? (
			<React.Fragment key={segment.offset}>{segment.text}</React.Fragment>
		) : (
			<Image
				key={segment.offset}
				src={emoji.src}
				alt={emoji.label}
				title={segment.text}
				width={INLINE_EMOJI_PX}
				height={INLINE_EMOJI_PX}
				className="inline-block h-lh w-auto align-top"
			/>
		);
	});
}

interface Author {
	readonly name: string;
	readonly initials: string;
	readonly avatar: string;
}

interface Post {
	readonly id: string;
	readonly author: Author;
	readonly time: string;
	readonly text: string;
}

function photo(id: string): string {
	return `https://images.unsplash.com/photo-${id}?w=96&h=96&dpr=2&q=80`;
}

const AMARA: Author = {
	name: "Amara Okafor",
	initials: "AO",
	avatar: photo("1519699047748-de8e457a634e"),
};
const MICHAEL: Author = {
	name: "Michael Rodriguez",
	initials: "MR",
	avatar: photo("1500648767791-00dcc994a43e"),
};
const DANIEL: Author = {
	name: "Daniel Kim",
	initials: "DK",
	avatar: photo("1535713875002-d1d0cf377fde"),
};
const PRIYA: Author = {
	name: "Priya Shah",
	initials: "PS",
	avatar: photo("1584308972272-9e4e7685e80f"),
};
const ME: Author = {
	name: "Mira Stone",
	initials: "MS",
	avatar: photo("1494790108377-be9c29b29330"),
};

const ROOT: Post = {
	id: "root",
	author: AMARA,
	time: "9:36 AM",
	text: "Release candidate is on staging :shipit: and one flaky checkout spec is left :wip:",
};

const REPLIES: readonly Post[] = [
	{
		id: "r1",
		author: MICHAEL,
		time: "9:48 AM",
		text: "Pinned the payment mock :hotfix:",
	},
	{
		id: "r2",
		author: DANIEL,
		time: "9:52 AM",
		text: "Green on all three browsers :lgtm:",
	},
	{
		id: "r3",
		author: PRIYA,
		time: "9:55 AM",
		text: "Release notes are merged :ty: :plusone:",
	},
];

interface PostItemProps {
	readonly post: Post;
	readonly variant?: "default" | "muted";
}

function PostItem({ post, variant = "default" }: PostItemProps): React.JSX.Element {
	return (
		<Item variant={variant}>
			{/* An empty alt: the name sits beside the photo, so a screen reader
          would otherwise read it twice. Top-aligned by hand, since Item only
          does that when it finds an ItemDescription. */}
			<ItemMedia className="self-start">
				<Avatar>
					<AvatarImage src={post.author.avatar} alt="" />
					<AvatarFallback>{post.author.initials}</AvatarFallback>
				</Avatar>
			</ItemMedia>
			<ItemContent>
				<ItemTitle>
					{post.author.name}
					<span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-muted-foreground/40" />
					<span className="font-normal text-muted-foreground">{post.time}</span>
				</ItemTitle>
				{/* Not ItemDescription, which clamps to two lines: a thread shows
            every message whole, the one you just sent included. */}
				<p className="text-pretty wrap-break-word">{renderText(post.text)}</p>
			</ItemContent>
		</Item>
	);
}

export function EmojiPicker5Example(): React.JSX.Element {
	const [replies, setReplies] = React.useState<readonly Post[]>(REPLIES);
	const [text, setText] = React.useState("");
	const inputRef = React.useRef<HTMLInputElement>(null);
	const empty = text.trim() === "";

	/* A blurred input keeps its selection, so the shortcode replaces it and
     the caret lands after it. Padding it with spaces keeps it a token of its
     own: in `at 10:30:ty:` the time would swallow the opening colon. */
	const insert = React.useCallback((code: string): void => {
		const field = inputRef.current;
		if (field === null) return;
		const { value, selectionStart, selectionEnd } = field;
		const start = selectionStart ?? value.length;
		const before = value.slice(0, start);
		const after = value.slice(selectionEnd ?? start);
		const chunk = `${before !== "" && !before.endsWith(" ") ? " " : ""}${code}${after.startsWith(" ") ? "" : " "}`;
		const caret = start + chunk.length + (after.startsWith(" ") ? 1 : 0);
		const next = before + chunk + after;
		field.value = next;
		field.setSelectionRange(caret, caret);
		setText(next);
	}, []);

	/* A fixed label, not a clock read, so the server render and the first
     client render agree. Focus goes back to the field for the next reply. */
	const send = React.useCallback((): void => {
		if (empty) return;
		setReplies([
			...replies,
			{
				id: `r${String(replies.length + 1)}`,
				author: ME,
				time: "Just now",
				text: text.trim(),
			},
		]);
		setText("");
		inputRef.current?.focus();
	}, [empty, replies, text]);

	const handleChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setText(event.target.value);
	}, []);

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>): void => {
			/* Enter that confirms an IME composition is not a send. */
			if (event.key === "Enter" && !event.nativeEvent.isComposing) send();
		},
		[send],
	);

	const handleEmojiSelect = React.useCallback(
		({ value }: EmojiPickerSelection): void => {
			insert(value);
		},
		[insert],
	);

	return (
		<Card className="w-full max-w-md">
			<CardHeader>
				<CardTitle>Release 4.2</CardTitle>
				<CardDescription>#release-train</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col gap-3">
					<PostItem post={ROOT} variant="muted" />
					{/* The rows bring their own padding, so a tight gap here keeps
              the label as far from the first reply as from the root. */}
					<div className="flex flex-col gap-1">
						<div className="flex items-center gap-3">
							<span className="shrink-0 text-xs text-muted-foreground">
								{replies.length} {replies.length === 1 ? "reply" : "replies"}
							</span>
							{/* Separator is shrink-0 at full width, so a flex-1 wrapper
                gives it the room the label leaves. */}
							<div className="flex-1">
								<Separator />
							</div>
						</div>
						{/* A log announces each reply as it lands, so a send needs no
              separate status region. */}
						<div role="log" aria-label="Replies" className="flex flex-col">
							{replies.map((reply) => (
								<PostItem key={reply.id} post={reply} />
							))}
						</div>
					</div>
				</div>
			</CardContent>
			<CardFooter>
				<InputGroup>
					<InputGroupInput ref={inputRef} value={text} onChange={handleChange} onKeyDown={handleKeyDown} placeholder="Reply" aria-label="Reply to thread" />
					<InputGroupAddon align="inline-end">
						{/* Controlled to null so the trigger keeps its smiley: this
                button inserts, it does not hold a value. Recent picks are
                kept per workspace, since another workspace's `:shortcode:`
                means nothing here. */}
						<EmojiPicker
							value={null}
							aria-label="Add emoji"
							customEmojis={TEAM_EMOJI}
							customCategories={CUSTOM_CATEGORIES}
							categories={CATEGORIES}
							recentStorageKey="northwind-emoji-recent"
							onEmojiSelect={handleEmojiSelect}>
							<EmojiPickerTrigger variant="ghost" size="icon-sm" />
							{/* Above the field so the draft stays in view; it flips below
                  when the thread leaves no room. */}
							<EmojiPickerContent side="top" align="end" returnFocus={inputRef} />
						</EmojiPicker>
						{/* Never `disabled`: inside an InputGroup that greys out the
                whole field. An empty send is a no-op that says so, and the
                button fills once there is a draft. It stays mounted rather
                than appearing with the draft, so the emoji button never
                jumps under the pointer. */}
						<Button variant={empty ? "ghost" : "default"} size="icon-sm" aria-label="Send reply" aria-disabled={empty} onClick={send}>
							<SendIcon aria-hidden="true" />
						</Button>
					</InputGroupAddon>
				</InputGroup>
			</CardFooter>
		</Card>
	);
}
