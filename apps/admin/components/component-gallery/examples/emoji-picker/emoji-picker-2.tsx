"use client";

import * as React from "react";
import { SendIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EmojiPicker, EmojiPickerContent, EmojiPickerTrigger, type EmojiPickerSelection } from "@workspace/ui/components/emoji-picker";

import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@workspace/ui/components/avatar";
import { Bubble, BubbleContent, BubbleGroup } from "@workspace/ui/components/bubble";
import { Button } from "@workspace/ui/components/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@workspace/ui/components/input-group";
import { Message, MessageAvatar, MessageContent, MessageHeader } from "@workspace/ui/components/message";
import { Separator } from "@workspace/ui/components/separator";

interface Author {
	readonly name: string;
	readonly initials: string;
	readonly avatar: string;
}

interface ChatLine {
	readonly id: string;
	readonly text: string;
}

interface ChatGroup {
	readonly id: string;
	/* No author means the group is yours: end-aligned, primary, no avatar. */
	readonly author?: Author;
	readonly time: string;
	readonly lines: readonly ChatLine[];
}

function photo(id: string): string {
	return `https://images.unsplash.com/photo-${id}?w=96&h=96&dpr=2&q=80`;
}

const AMARA: Author = {
	name: "Amara Okafor",
	initials: "AO",
	avatar: photo("1519699047748-de8e457a634e"),
};
const LUCAS: Author = {
	name: "Lucas Martin",
	initials: "LM",
	avatar: photo("1527980965255-d3b416303d12"),
};
const PRIYA: Author = {
	name: "Priya Shah",
	initials: "PS",
	avatar: photo("1584308972272-9e4e7685e80f"),
};
const MIRA: Author = {
	name: "Mira Stone",
	initials: "MS",
	avatar: photo("1494790108377-be9c29b29330"),
};

const MEMBERS: readonly Author[] = [AMARA, LUCAS, PRIYA, MIRA];

const THREAD: readonly ChatGroup[] = [
	{
		id: "g0",
		author: PRIYA,
		time: "9:05 AM",
		lines: [{ id: "g0-l0", text: "Morning! Slides are in the shared drive." }],
	},
	{
		id: "g1",
		author: AMARA,
		time: "9:12 AM",
		lines: [
			{ id: "g1-l0", text: "Launch review moved to 4 PM." },
			{ id: "g1-l1", text: "Can everyone still make it?" },
		],
	},
	{
		id: "g2",
		author: LUCAS,
		time: "9:14 AM",
		lines: [{ id: "g2-l0", text: "Works for me 👍" }],
	},
	{
		id: "g3",
		time: "9:15 AM",
		lines: [{ id: "g3-l0", text: "I'm in. Demo build is ready." }],
	},
	{
		id: "g4",
		author: PRIYA,
		time: "9:21 AM",
		lines: [{ id: "g4-l0", text: "Same. Big room is booked." }],
	},
];

export function EmojiPicker2Example(): React.JSX.Element {
	const [groups, setGroups] = useState(THREAD);
	const [text, setText] = useState("");
	const logRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const empty = !text.trim();

	/* Keyed on the array, not its length: a follow-up joins your last group
     and leaves the length unchanged. */
	useEffect(() => {
		const log = logRef.current;
		if (log) log.scrollTop = log.scrollHeight;
	}, [groups]);

	/* A blurred input keeps its selection, so the emoji replaces it and the
     caret lands after it. Set here rather than after focus returns, because
     a Shift+click pick keeps the picker open. */
	const insert = React.useCallback((emoji: string): void => {
		const field = inputRef.current;
		if (field === null) return;
		const { value } = field;
		const start = field.selectionStart ?? value.length;
		const end = field.selectionEnd ?? start;
		const next = value.slice(0, start) + emoji + value.slice(end);
		const caret = start + emoji.length;
		field.value = next;
		field.setSelectionRange(caret, caret);
		setText(next);
	}, []);

	/* A fixed label, not a clock read, so the server render and the first
     client render agree. */
	const send = React.useCallback((): void => {
		if (empty) return;
		const nextGroupNumber = groups.length + 1;
		const last = groups.at(-1);
		if (last !== undefined && last.author === undefined) {
			const line: ChatLine = { id: `${last.id}-l${String(last.lines.length)}`, text: text.trim() };
			setGroups([...groups.slice(0, -1), { ...last, lines: [...last.lines, line] }]);
		} else {
			const id = `g${String(nextGroupNumber)}`;
			setGroups([...groups, { id, time: "Just now", lines: [{ id: `${id}-l0`, text: text.trim() }] }]);
		}
		setText("");
		inputRef.current?.focus();
	}, [empty, groups, text]);

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
				<CardTitle>#launch-crew</CardTitle>
				<CardDescription>4 members</CardDescription>
				<CardAction>
					{/* Decorative: the description already gives the count, and four
              names read out before the thread would only be noise. */}
					<AvatarGroup aria-hidden="true">
						{MEMBERS.map((member) => (
							<Avatar key={member.name} size="sm">
								<AvatarImage src={member.avatar} alt="" />
								<AvatarFallback>{member.initials}</AvatarFallback>
							</Avatar>
						))}
					</AvatarGroup>
				</CardAction>
			</CardHeader>
			{/* One wrapper, so no Card gap falls between the rule and the
          scroller: once the thread outgrows its cap, older messages scroll
          under the rule itself. */}
			<div>
				<Separator />
				{/* The seeded thread fits under the cap in every style, so it opens
            whole; sends grow it until it scrolls. A log announces each
            message as it lands, and it is focusable so Safari keyboard users
            can scroll back through the history. */}
				<CardContent ref={logRef} role="log" aria-label="Messages in #launch-crew" tabIndex={0} className="max-h-160 overflow-y-auto">
					<div className="flex flex-col gap-6 pt-4">
						{groups.map((group) => (
							<Message key={group.id} align={group.author ? "start" : "end"}>
								{group.author ? (
									<MessageAvatar aria-hidden="true" className="self-start">
										<Avatar>
											<AvatarImage src={group.author.avatar} alt="" />
											<AvatarFallback>{group.author.initials}</AvatarFallback>
										</Avatar>
									</MessageAvatar>
								) : null}
								<MessageContent>
									<MessageHeader>
										<span className="flex items-center gap-1.5">
											{group.author ? (
												<>
													<span className="text-foreground">{group.author.name}</span>
													<span aria-hidden="true" className="size-1 shrink-0 rounded-full bg-muted-foreground/40" />
												</>
											) : (
												/* Your own groups show only the time, as chat apps
                         do. The hidden word keeps the log from announcing
                         a bare time. */
												<span className="sr-only">You</span>
											)}
											<span className="font-normal">{group.time}</span>
										</span>
									</MessageHeader>
									{/* An end row shrinks to fit, so the bubbles' 80% cap would
                    resolve against the group and wrap a short line. */}
									<BubbleGroup className="w-full">
										{group.lines.map((line) => (
											<Bubble key={line.id} variant={group.author ? "muted" : "default"}>
												<BubbleContent>{line.text}</BubbleContent>
											</Bubble>
										))}
									</BubbleGroup>
								</MessageContent>
							</Message>
						))}
					</div>
				</CardContent>
			</div>
			<CardContent>
				<InputGroup>
					<InputGroupInput
						ref={inputRef}
						value={text}
						onChange={handleChange}
						onKeyDown={handleKeyDown}
						placeholder="Message #launch-crew"
						aria-label="Message #launch-crew"
					/>
					<InputGroupAddon align="inline-end">
						{/* Controlled to null so the trigger keeps its smiley: this
                button inserts, it does not hold a value. */}
						<EmojiPicker value={null} aria-label="Add emoji" onEmojiSelect={handleEmojiSelect}>
							<EmojiPickerTrigger variant="ghost" size="icon-sm" />
							{/* Above the field so the draft stays in view; it flips below
                  when the page leaves no room. */}
							<EmojiPickerContent side="top" align="end" returnFocus={inputRef} />
						</EmojiPicker>
						{/* Never `disabled`: inside an InputGroup that greys out the
                whole composer. An empty send is a no-op that says so, and
                the button fills once there is a draft. */}
						<Button variant={empty ? "ghost" : "default"} size="icon-sm" aria-label="Send message" aria-disabled={empty} onClick={send}>
							<SendIcon aria-hidden="true" />
						</Button>
					</InputGroupAddon>
				</InputGroup>
			</CardContent>
		</Card>
	);
}
