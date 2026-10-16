"use client";

import {
	EmojiPicker,
	EmojiPickerContent,
	EmojiPickerTrigger,
	getEmojiValue,
	searchEmojis,
	useEmojiPickerData,
	type EmojiPickerEmoji,
	type EmojiPickerSelection,
} from "@workspace/ui/components/emoji-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@workspace/ui/components/item";
import type { SearchEmojisOptions } from "@workspace/ui/lib/emoji-picker/search";
import { SendIcon } from "lucide-react";
import * as React from "react";

interface Author {
	readonly name: string;
	readonly initials: string;
	readonly avatar: string;
}

interface Comment {
	readonly id: string;
	readonly author: Author;
	readonly time: string;
	readonly text: string;
}

function photo(id: string): string {
	return `https://images.unsplash.com/photo-${id}?w=96&h=96&dpr=2&q=80`;
}

const PRIYA: Author = {
	name: "Priya Shah",
	initials: "PS",
	avatar: photo("1584308972272-9e4e7685e80f"),
};
const LUCAS: Author = {
	name: "Lucas Martin",
	initials: "LM",
	avatar: photo("1527980965255-d3b416303d12"),
};
const ME: Author = {
	name: "Mira Stone",
	initials: "MS",
	avatar: photo("1494790108377-be9c29b29330"),
};

const THREAD: readonly Comment[] = [
	{
		id: "c1",
		author: PRIYA,
		time: "10:12 AM",
		text: "Moved the promo code field under the total and tightened the order summary. Ready for another look.",
	},
	{
		id: "c2",
		author: LUCAS,
		time: "10:20 AM",
		text: "Pay button stays above the fold on the smallest phones now.",
	},
];

/* Ends mid-shortcode so the suggestions already show on load. */
const DRAFT = "So much cleaner now :fire";

/** How many suggestions the list shows at most. */
const SUGGESTION_LIMIT = 5;
const SEARCH_OPTIONS: SearchEmojisOptions = { limit: SUGGESTION_LIMIT };
const NO_SUGGESTIONS: readonly EmojiPickerEmoji[] = [];

/* `:` then two or more letters, right before the caret. */
const TOKEN = /(?:^|\s):(?<token>[\p{L}\p{N}_+-]{2,})$/u;
/* The rest of the word after the caret, replaced along with the token. */
const TAIL = /^(?<tail>[\p{L}\p{N}_+-]*)/u;
/* A finished `:shortcode:`, converted as soon as the closing colon lands. */
const FINISHED = /(?<whole>:(?<code>[a-z0-9_+-]+):)$/;
/* A run of whitespace in a label, which a shortcode spells as `_`. */
const WHITESPACE_RUN = /\s+/g;
/* Whitespace leading the text after the caret. */
const LEADING_SPACE = /^\s/;

function shortcodeOf(emoji: EmojiPickerEmoji): string {
	const [shortcode = emoji.label.replace(WHITESPACE_RUN, "_")] = emoji.shortcodes;
	return `:${shortcode}:`;
}

function sentenceCase(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

interface CommentRowProps {
	readonly comment: Comment;
}

function CommentRow({ comment }: CommentRowProps): React.JSX.Element {
	return (
		<div className="flex gap-3">
			{/* An empty alt: the name sits beside the photo. */}
			<Avatar>
				<AvatarImage src={comment.author.avatar} alt="" />
				<AvatarFallback>{comment.author.initials}</AvatarFallback>
			</Avatar>
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<div className="flex items-center gap-2 font-medium">
					{comment.author.name}
					<span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-muted-foreground/40" />
					<span className="font-normal text-muted-foreground">{comment.time}</span>
				</div>
				<p className="text-pretty wrap-break-word">{comment.text}</p>
			</div>
		</div>
	);
}

interface SuggestionOptionProps {
	readonly emoji: EmojiPickerEmoji;
	readonly index: number;
	readonly optionId: string;
	readonly isActive: boolean;
	readonly onHighlight: (index: number) => void;
	readonly onAccept: (emoji: EmojiPickerEmoji) => void;
}

function SuggestionOption({ emoji, index, optionId, isActive, onHighlight, onAccept }: SuggestionOptionProps): React.JSX.Element {
	const handlePointerMove = React.useCallback((): void => {
		onHighlight(index);
	}, [index, onHighlight]);
	const handleClick = React.useCallback((): void => {
		onAccept(emoji);
	}, [emoji, onAccept]);
	return (
		<Item
			id={optionId}
			role="option"
			size="xs"
			/* Outline, not muted: bg-muted/50 all but vanishes on a
			   tinted footer, a border reads in every style and theme. */
			variant={isActive ? "outline" : "default"}
			aria-selected={isActive}
			onPointerMove={handlePointerMove}
			onClick={handleClick}>
			<ItemMedia aria-hidden="true">
				<span className="text-xl leading-none">{emoji.emoji}</span>
			</ItemMedia>
			<ItemContent className="min-w-0">
				{/* One row on a shared baseline: the 12px shortcode centred beside
				    the 14px name sits visibly high. Both ellipsize, so a long name
				    never wraps the row or pushes the emoji onto a line of its own;
				    the shortcode, which repeats the name, gives way first. */}
				<div className="flex min-w-0 items-baseline justify-between gap-2">
					<ItemTitle>
						<span className="truncate">{sentenceCase(emoji.label)}</span>
					</ItemTitle>
					<ItemDescription className="shrink-3">
						<span className="block truncate">{shortcodeOf(emoji)}</span>
					</ItemDescription>
				</div>
			</ItemContent>
		</Item>
	);
}

/* A press would blur the field, closing the list before the click lands. */
function keepFieldFocus(event: React.PointerEvent<HTMLDivElement>): void {
	event.preventDefault();
}

export function EmojiPicker6Example(): React.JSX.Element {
	const id = React.useId();
	/* The same shared data the picker loads, fetched once for both. */
	const { data } = useEmojiPickerData();
	const [comments, setComments] = React.useState<readonly Comment[]>(THREAD);
	const [text, setText] = React.useState(DRAFT);
	const [caret, setCaret] = React.useState(DRAFT.length);
	const [highlight, setHighlight] = React.useState(0);
	/* Escape hides the list for this exact token only; the next keystroke
	   makes a new token and the list comes back. */
	const [dismissed, setDismissed] = React.useState<string | null>(null);
	const fieldRef = React.useRef<HTMLInputElement>(null);
	const empty = text.trim() === "";

	/* The DOM caret starts at 0 while `caret` starts at the end; matching them
	   makes a click into the field resume where the draft stops. */
	React.useEffect((): void => {
		fieldRef.current?.setSelectionRange(DRAFT.length, DRAFT.length);
	}, []);

	const token = TOKEN.exec(text.slice(0, caret))?.groups?.token ?? null;
	const suggestions = React.useMemo(
		(): readonly EmojiPickerEmoji[] => (token !== null && data !== null && token !== dismissed ? searchEmojis(data.emojis, token, SEARCH_OPTIONS) : NO_SUGGESTIONS),
		[data, dismissed, token],
	);
	const active = suggestions.at(Math.min(highlight, suggestions.length - 1));
	const open = suggestions.length > 0;

	const place = React.useCallback((next: string, position: number): void => {
		setText(next);
		setCaret(position);
		setHighlight(0);
		/* Focus now, the caret after React writes the value, or the browser
		   parks it at the end of the text. A focus() deferred to that frame
		   would pull focus back from wherever a fast Tab already took it. */
		fieldRef.current?.focus();
		requestAnimationFrame((): void => {
			fieldRef.current?.setSelectionRange(position, position);
		});
	}, []);

	const accept = React.useCallback(
		(emoji: EmojiPickerEmoji): void => {
			if (token === null) return;
			const from = caret - token.length - 1;
			const to = caret + (TAIL.exec(text.slice(caret))?.groups?.tail?.length ?? 0);
			const rest = text.slice(to);
			const value = getEmojiValue(emoji);
			/* Reuse a space that already follows the word instead of doubling it;
			   either way the caret lands after the space, ready for the next word. */
			const inserted = LEADING_SPACE.test(rest) ? value : `${value} `;
			place(text.slice(0, from) + inserted + rest, from + value.length + 1);
		},
		[caret, place, text, token],
	);

	/* A pick from the picker lands at the caret. The field is blurred while
	   the popover is open, so this writes the value and the selection by
	   hand; returnFocus brings focus back with the caret already placed. */
	const insert = React.useCallback(
		(value: string): void => {
			const field = fieldRef.current;
			if (field === null) return;
			const start = field.selectionStart ?? text.length;
			const end = field.selectionEnd ?? start;
			const next = text.slice(0, start) + value + text.slice(end);
			field.value = next;
			field.setSelectionRange(start + value.length, start + value.length);
			setText(next);
			setCaret(start + value.length);
		},
		[text],
	);

	const post = React.useCallback((): void => {
		/* An empty submit sends the user back to the field. */
		if (empty) {
			fieldRef.current?.focus();
			return;
		}
		setComments([
			...comments,
			{
				id: `c${String(comments.length + 1)}`,
				author: ME,
				time: "Just now",
				text: text.trim(),
			},
		]);
		setDismissed(null);
		place("", 0);
	}, [comments, empty, place, text]);

	const handleSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			post();
		},
		[post],
	);

	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			const { value } = event.target;
			const position = event.target.selectionStart ?? value.length;
			setText(value);
			setCaret(position);
			setHighlight(0);
			setDismissed(null);
			const finished = FINISHED.exec(value.slice(0, position))?.groups;
			const whole = finished?.whole;
			const code = finished?.code;
			if (whole === undefined || code === undefined) return;
			const match = data?.emojis.find((emoji) => emoji.shortcodes.includes(code));
			if (match === undefined) return;
			const head = value.slice(0, position - whole.length) + getEmojiValue(match);
			place(head + value.slice(position), head.length);
		},
		[data, place],
	);

	/* The selection end, so a select-all on focus keeps the token under the caret. */
	const handleSelect = React.useCallback((event: React.SyntheticEvent<HTMLInputElement>): void => {
		setCaret(event.currentTarget.selectionEnd ?? 0);
	}, []);

	/* A list left open after focus moves on reads as stuck. Coming back to an
	   unfinished token shows it again. */
	const handleBlur = React.useCallback((): void => {
		setDismissed(token);
	}, [token]);

	const handleFocus = React.useCallback((): void => {
		setDismissed(null);
	}, []);

	const handleKeyDown = React.useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>): void => {
			/* Enter also confirms an IME composition; that one belongs to the input method. */
			if (event.nativeEvent.isComposing) return;
			/* Cmd/Ctrl+Enter posts the draft as typed, list or not. */
			if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
				event.preventDefault();
				post();
				return;
			}
			/* With no list open, Enter submits and Tab leaves. */
			if (active === undefined) return;
			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault();
				const step = event.key === "ArrowDown" ? 1 : -1;
				setHighlight((suggestions.indexOf(active) + step + suggestions.length) % suggestions.length);
			} else if (event.key === "Enter" || (event.key === "Tab" && !event.shiftKey)) {
				event.preventDefault();
				accept(active);
			} else if (event.key === "Escape") {
				event.preventDefault();
				setDismissed(token);
			}
		},
		[accept, active, post, suggestions, token],
	);

	/* Opening the picker hides the suggestions, which would sit under the popover. */
	const handlePickerOpenChange = React.useCallback(
		(next: boolean): void => {
			if (next) setDismissed(token);
		},
		[token],
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
				<CardTitle>Mobile checkout</CardTitle>
				<CardDescription>Design review</CardDescription>
			</CardHeader>
			<CardContent>
				{/* Plain rows, not Items: an Item pads its media in from the edge
				    the title and the composer share. A log announces each comment
				    as it lands, so a post needs no separate status region. */}
				<div role="log" aria-label="Comments" className="flex flex-col gap-4">
					{comments.map((comment): React.JSX.Element => (
						<CommentRow key={comment.id} comment={comment} />
					))}
				</div>
			</CardContent>
			<CardFooter>
				<form onSubmit={handleSubmit} className="flex w-full flex-col gap-2">
					<p role="status" className="sr-only">
						{open ? `${String(suggestions.length)} emoji suggestion${suggestions.length === 1 ? "" : "s"}` : ""}
					</p>
					<InputGroup>
						<InputGroupInput
							ref={fieldRef}
							value={text}
							role="combobox"
							aria-expanded={open}
							aria-controls={open ? `${id}-list` : undefined}
							aria-activedescendant={active === undefined ? undefined : `${id}-${active.id}`}
							aria-autocomplete="list"
							aria-label="Add a comment"
							placeholder="Add a comment"
							onChange={handleChange}
							onSelect={handleSelect}
							onBlur={handleBlur}
							onFocus={handleFocus}
							onKeyDown={handleKeyDown}
						/>
						<InputGroupAddon align="inline-end">
							{/* Controlled to null so the trigger keeps its smiley: this
							    button inserts, it does not hold a value. */}
							<EmojiPicker value={null} aria-label="Add emoji" onOpenChange={handlePickerOpenChange} onEmojiSelect={handleEmojiSelect}>
								<EmojiPickerTrigger variant="ghost" size="icon-sm" />
								{/* Above the field so the thread stays in view; it flips
								    below when the page leaves no room. */}
								<EmojiPickerContent side="top" align="end" returnFocus={fieldRef} />
							</EmojiPicker>
							{/* Never `disabled`: inside an InputGroup that greys out the
							    whole field. The button fills once there is a draft. */}
							<Button type="submit" variant={empty ? "ghost" : "default"} size="icon-sm" aria-label="Post comment" aria-disabled={empty}>
								<SendIcon aria-hidden="true" />
							</Button>
						</InputGroupAddon>
					</InputGroup>
					{/* Under the field, so the line being typed never moves when it
					    opens. Rows are not focusable: the field keeps focus and
					    aria-activedescendant points at one. */}
					{open ? (
						<div id={`${id}-list`} role="listbox" aria-label="Emoji suggestions" className="flex flex-col" onPointerDown={keepFieldFocus}>
							{suggestions.map((emoji, index): React.JSX.Element => (
								<SuggestionOption
									key={emoji.id}
									emoji={emoji}
									index={index}
									optionId={`${id}-${emoji.id}`}
									isActive={emoji === active}
									onHighlight={setHighlight}
									onAccept={accept}
								/>
							))}
						</div>
					) : null}
				</form>
			</CardFooter>
		</Card>
	);
}
