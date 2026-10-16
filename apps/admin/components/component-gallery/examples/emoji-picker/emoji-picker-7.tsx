"use client";

import * as React from "react";
import { CircleCheckIcon } from "lucide-react";
import { EmojiPicker, EmojiPickerContent, EmojiPickerTrigger, type EmojiPickerEmoji, type EmojiPickerSelection } from "@workspace/ui/components/emoji-picker";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Item, ItemContent, ItemMedia, ItemTitle } from "@workspace/ui/components/item";
import { Textarea } from "@workspace/ui/components/textarea";

/* The tabs a kudos note needs. Nature, food, travel and flags leave the
   browse view only: search still reaches every emoji the filter keeps.
   Recent shares its stored list with every picker in the app but resolves
   through the same filter, so a blocked emoji picked elsewhere never
   resurfaces here. */
const CATEGORIES: readonly string[] = ["recent", "smileys", "people", "activities", "objects", "symbols"];

/* Hexcodes kept out of a workplace recognition tool. */
const BLOCKED: ReadonlySet<string> = new Set<string>(["1F346", "1F351", "1F4A9", "1F595", "1F52B", "1F92C"]);

/* Module scope, so the filter keeps one identity across renders. */
function workplaceSafe(emoji: EmojiPickerEmoji): boolean {
	return !BLOCKED.has(emoji.id);
}

/** Emoji 14 and older: the newest set every laptop in the company draws. */
const WORKPLACE_EMOJI_VERSION = 14;

/* A space goes after a word or a sentence mark, never after a space, an
   opening bracket or another emoji, so two picks in a row sit flush. */
const SPACE_AFTER = /[^\s\p{Ps}\p{Pi}\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u{FE0F}\u{20E3}\u{E007F}]$/u;

/* And before a word, never before the comma or stop that follows it. */
const SPACE_BEFORE = /^[\p{L}\p{N}]/u;

export function EmojiPicker7Example(): React.JSX.Element {
	const [note, setNote] = React.useState("");
	const [sent, setSent] = React.useState(false);
	const noteRef = React.useRef<HTMLTextAreaElement>(null);
	const confirmationRef = React.useRef<HTMLParagraphElement>(null);

	/* A blurred textarea keeps its selection, so the pick lands at the caret,
     spaced off the words beside it, and the caret stays right after it. */
	const insert = React.useCallback((emoji: string): void => {
		const field = noteRef.current;
		if (field === null) return;
		const { value, selectionStart, selectionEnd } = field;
		const before = value.slice(0, selectionStart);
		const after = value.slice(selectionEnd);
		const lead = SPACE_AFTER.test(before) ? " " : "";
		const trail = SPACE_BEFORE.test(after) ? " " : "";
		const caret = before.length + lead.length + emoji.length;
		field.value = before + lead + emoji + trail + after;
		field.setSelectionRange(caret, caret);
		setNote(field.value);
	}, []);

	/* Send unmounts with the composer, so focus moves to the confirmation
     instead of falling back to the page body. The frame waits for the
     commit that mounts it. */
	const send = React.useCallback((): void => {
		setSent(true);
		requestAnimationFrame((): void => {
			confirmationRef.current?.focus();
		});
	}, []);

	/* Undo brings the draft back untouched, caret at the end. */
	const undo = React.useCallback((): void => {
		setSent(false);
		requestAnimationFrame((): void => {
			const field = noteRef.current;
			field?.focus();
			field?.setSelectionRange(field.value.length, field.value.length);
		});
	}, []);

	const handleChange = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>): void => {
		setNote(event.target.value);
	}, []);

	const handleEmojiSelect = React.useCallback(
		({ value }: EmojiPickerSelection): void => {
			insert(value);
		},
		[insert],
	);

	return (
		<Card className="w-full max-w-sm">
			<CardHeader>
				{/* CardHeader is a grid that adds a second row once it holds a
            description, so the wrapper spans both or the gap doubles. */}
				<div className="row-span-2 flex items-center gap-3">
					<Avatar size="lg">
						<AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80" alt="" />
						<AvatarFallback>DK</AvatarFallback>
					</Avatar>
					<div className="flex min-w-0 flex-col gap-0.5">
						<CardTitle>Kudos for Daniel Kim</CardTitle>
						<CardDescription>Staff engineer, Platform</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{sent ? (
					/* The kudos renders as the feed entry it became. A plain paragraph,
             not ItemDescription, which clamps to two lines: this is where the
             sender reads back the whole note. */
					<Item variant="muted">
						<ItemMedia className="self-start">
							<Avatar>
								<AvatarImage src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=96&h=96&dpr=2&q=80" alt="" />
								<AvatarFallback>MS</AvatarFallback>
							</Avatar>
						</ItemMedia>
						<ItemContent>
							<ItemTitle>
								Mira Stone
								<span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-muted-foreground/40" />
								<span className="font-normal text-muted-foreground">Just now</span>
							</ItemTitle>
							<p className="wrap-break-word whitespace-pre-wrap">{note.trim()}</p>
						</ItemContent>
					</Item>
				) : (
					<Textarea ref={noteRef} value={note} onChange={handleChange} placeholder="Write a note for Daniel" aria-label="Kudos for Daniel Kim" />
				)}
			</CardContent>
			<CardFooter>
				{sent ? (
					/* Undo sits at the start, away from where Send was, so a double
             click cannot send and take it back. No gap: the link's own
             padding spaces it, so it reads as part of the sentence. */
					<div className="flex items-center">
						{/* A focus target, not a live region: the announcement lives in
                the always-mounted status below, so it is read once. */}
						<p ref={confirmationRef} tabIndex={-1} className="flex items-center gap-2 text-muted-foreground outline-none">
							<CircleCheckIcon aria-hidden="true" className="size-4" />
							Posted in #platform
						</p>
						{/* Default size like Send, so the footer keeps its height. */}
						<Button variant="link" onClick={undo}>
							Undo
						</Button>
					</div>
				) : (
					<div className="flex w-full items-center justify-between gap-2">
						<p className="text-muted-foreground">Posts to #platform</p>
						<div className="flex items-center gap-2">
							{/* Emoji 14 and older, so every laptop in the company draws
                  them, minus the blocklist. Controlled to null so the
                  trigger keeps its smiley: it inserts, it holds no value. */}
							<EmojiPicker
								value={null}
								aria-label="Add emoji"
								categories={CATEGORIES}
								emojiVersion={WORKPLACE_EMOJI_VERSION}
								filter={workplaceSafe}
								onEmojiSelect={handleEmojiSelect}>
								{/* Icon at Send's height, so the pair shares one baseline. */}
								<EmojiPickerTrigger variant="ghost" size="icon" />
								{/* Below the card, ending at the trigger: the note, the
                    channel and Send all stay in view while picking. */}
								<EmojiPickerContent side="bottom" align="end" returnFocus={noteRef} />
							</EmojiPicker>
							<Button disabled={note.trim() === ""} onClick={send}>
								Send kudos
							</Button>
						</div>
					</div>
				)}
			</CardFooter>
			{/* Mounted from the start, so a screen reader is already watching it
          when the text arrives; a region inserted with its content is read
          unreliably. */}
			<p role="status" className="sr-only">
				{sent ? "Kudos for Daniel Kim posted in #platform" : ""}
			</p>
		</Card>
	);
}
