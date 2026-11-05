"use client";

import { BROADCAST_TITLE_MAX_LENGTH, type BroadcastChannel, type BroadcastDraftInput, type RichTextDocument } from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { DatePicker } from "@workspace/ui/components/date-picker";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { RadioGroup, RadioGroupItem } from "@workspace/ui/components/radio-group";
import type { RichTextEditorContent } from "@workspace/ui/components/rich-text-editor";
import { RichTextView } from "@workspace/ui/components/rich-text-view";
import { Spinner } from "@workspace/ui/components/spinner";
import { TimePicker } from "@workspace/ui/components/time-picker";
import { Skeleton } from "@workspace/ui/components/skeleton";
import * as React from "react";
import { z } from "zod";

import {
	BROADCAST_CHANNEL_LABELS,
	BROADCAST_CHANNEL_OPTIONS,
	BroadcastTimingSchema,
	toBroadcastBody,
	type BroadcastComposerErrors,
	type BroadcastDraftResult,
	type BroadcastScheduleValues,
	type BroadcastTiming,
} from "./broadcast-draft";
import type { BroadcastPictureUpload } from "./broadcast-body-editor";

/** The editor engine loads on its own (enhancement 8.3), so the rest of the composer shows at once. */
const BroadcastBodyEditor = React.lazy(() => import("./broadcast-body-editor"));

/** What a save asks for: keep it as a draft, or send it (schedule) right after saving. */
export const BroadcastSaveIntentSchema = z.enum(["draft", "send"]);
export type BroadcastSaveIntent = z.output<typeof BroadcastSaveIntentSchema>;

function resolveSaveIntent(submitter: HTMLElement | null): BroadcastSaveIntent {
	const parsed = BroadcastSaveIntentSchema.safeParse(submitter?.getAttribute("value"));
	return parsed.success ? parsed.data : "draft";
}

/** A choice drawn as a bordered tile that fills while it is picked (channels, timing, audiences). */
export const BROADCAST_CHOICE_SURFACE_CLASS =
	"flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3 font-normal transition-colors duration-150 hover:border-foreground/20 has-data-checked:border-primary has-data-checked:bg-primary/5 has-data-disabled:cursor-not-allowed has-data-disabled:opacity-60 motion-reduce:transition-none dark:has-data-checked:bg-primary/10";

/** What every composer holds while someone writes: the message, the channels and the send time. */
export interface BroadcastMessageValues extends BroadcastScheduleValues {
	readonly title: string;
	/** The editor's document; null until something valid is written. */
	readonly body: RichTextDocument | null;
	readonly channels: readonly BroadcastChannel[];
}

/** The words that differ between senders (a store writing to its customers, staff writing to users). */
export interface BroadcastComposerCopy {
	readonly titlePlaceholder: string;
	readonly bodyPlaceholder: string;
	readonly audienceTitle: string;
	readonly audienceDescription: string;
	readonly deliveryDescription: string;
	/** The two timing hints that name whose time zone counts. */
	readonly atTimeHint: string;
	readonly recipientLocalHint: string;
	readonly recipientLocalLabel: string;
	readonly previewHeading: string;
}

export interface BroadcastAudienceSlot<TValues extends BroadcastMessageValues> {
	readonly values: TValues;
	readonly onChange: (change: Partial<TValues>) => void;
	readonly error: string | undefined;
	readonly disabled: boolean;
}

export interface BroadcastComposerFormProps<TValues extends BroadcastMessageValues> {
	readonly initialValues: TValues;
	readonly copy: BroadcastComposerCopy;
	/** The draft the API receives, or what is still missing (the sender's own audience rules included). */
	readonly toDraft: (values: TValues, now: number) => BroadcastDraftResult;
	/** The "Who gets it" fields: the sender's own audience. */
	readonly renderAudience: (slot: BroadcastAudienceSlot<TValues>) => React.ReactNode;
	/** Why sending is out of the question (drafts only), or null. */
	readonly sendDisabledReason: string | null;
	readonly isSaving: boolean;
	readonly savingIntent: BroadcastSaveIntent | undefined;
	readonly onSave: (draft: BroadcastDraftInput, intent: BroadcastSaveIntent) => void;
	readonly cancel: React.ReactNode;
	/** The sender's picture upload (enhancement 5.4: a store's or the platform's file category); none hides the control. */
	readonly picture?: BroadcastPictureUpload | undefined;
}

/**
 * A broadcast composer (ADR 073): a title, the message in the rich-text editor, who gets it (the
 * sender's own section), how and when — with what recipients will see beside it. The shared draft
 * schema decides what is valid; the server checks links, limits and consent again when it is saved and
 * when it is sent.
 */
export function BroadcastComposerForm<TValues extends BroadcastMessageValues>({
	initialValues,
	copy,
	toDraft,
	renderAudience,
	sendDisabledReason,
	isSaving,
	savingIntent,
	onSave,
	cancel,
	picture,
}: BroadcastComposerFormProps<TValues>): React.JSX.Element {
	// Plain state, not TanStack Form: the body is a recursive document type the form's path types cannot expand.
	const [values, setValues] = React.useState<TValues>(initialValues);
	// When the sender last tried to save: null until then; the "has this time passed" check reads it as now.
	const [attemptedAt, setAttemptedAt] = React.useState<number | null>(null);
	const patch = React.useCallback((change: Partial<TValues>): void => {
		setValues((current) => ({ ...current, ...change }));
	}, []);
	// Once the sender tried to save, the messages follow their edits.
	const errors = React.useMemo((): BroadcastComposerErrors => {
		if (attemptedAt === null) {
			return {};
		}
		const result = toDraft(values, attemptedAt);
		return result.ok ? {} : result.errors;
	}, [attemptedAt, toDraft, values]);

	const [initialBody] = React.useState(initialValues.body);
	const handleBodyChange = React.useCallback((content: RichTextEditorContent): void => {
		setValues((current) => ({ ...current, body: toBroadcastBody(content) }));
	}, []);

	const handleTitleChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		const title = event.currentTarget.value;
		setValues((current) => ({ ...current, title }));
	}, []);
	const handleChannelToggle = React.useCallback((channel: BroadcastChannel, checked: boolean): void => {
		setValues((current) => ({
			...current,
			channels: checked
				? BROADCAST_CHANNEL_OPTIONS.filter((option: BroadcastChannel): boolean => option === channel || current.channels.includes(option))
				: current.channels.filter((option: BroadcastChannel): boolean => option !== channel),
		}));
	}, []);
	const handleTimingChange = React.useCallback((value: string): void => {
		const parsed = BroadcastTimingSchema.safeParse(value);
		if (parsed.success) {
			const timing = parsed.data;
			setValues((current) => ({ ...current, timing }));
		}
	}, []);
	const handleDateChange = React.useCallback((sendDate: string): void => {
		setValues((current) => ({ ...current, sendDate }));
	}, []);
	const handleTimeChange = React.useCallback((sendTime: string | null): void => {
		if (sendTime !== null) {
			const time = sendTime.slice(0, "HH:mm".length);
			setValues((current) => ({ ...current, sendTime: time }));
		}
	}, []);

	const handleSubmit = React.useCallback(
		(event: React.SubmitEvent<HTMLFormElement>): void => {
			event.preventDefault();
			const now = Date.now();
			setAttemptedAt(now);
			const intent = resolveSaveIntent(event.submitter);
			const result = toDraft(values, now);
			if (result.ok) {
				onSave(result.draft, intent);
			}
		},
		[onSave, toDraft, values],
	);

	const timingOptions: readonly { readonly value: BroadcastTiming; readonly label: string; readonly hint: string }[] = [
		{ value: "now", label: "As soon as I send it", hint: "It goes out within a minute." },
		{ value: "at-time", label: "At a set time", hint: copy.atTimeHint },
		{ value: "recipient-local-time", label: copy.recipientLocalLabel, hint: copy.recipientLocalHint },
	];

	return (
		<form onSubmit={handleSubmit} noValidate className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
			<Card className="gap-0 p-0">
				<ComposerSection id="broadcast-message" title="Message" description="A title, then what you want to say. Links must start with https://.">
					<div className="flex flex-col gap-2">
						<Label htmlFor="title">Title</Label>
						<Input
							id="title"
							value={values.title}
							onChange={handleTitleChange}
							maxLength={BROADCAST_TITLE_MAX_LENGTH}
							placeholder={copy.titlePlaceholder}
							disabled={isSaving}
							{...fieldErrorProps("title", errors.title)}
						/>
						<FieldError field="title" message={errors.title} />
					</div>
					<div className="flex flex-col gap-2">
						<span className="text-sm font-medium text-foreground">Message</span>
						<React.Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" data-testid="broadcast-body-editor-loading" />}>
							<BroadcastBodyEditor
								initialBody={initialBody}
								onChange={handleBodyChange}
								placeholder={copy.bodyPlaceholder}
								disabled={isSaving}
								invalid={errors.body !== undefined}
								picture={picture}
							/>
						</React.Suspense>
						<FieldError field="body" message={errors.body} />
					</div>
				</ComposerSection>

				<ComposerSection id="broadcast-recipients" title={copy.audienceTitle} description={copy.audienceDescription}>
					{renderAudience({ values, onChange: patch, error: errors.audience, disabled: isSaving })}
				</ComposerSection>

				<ComposerSection id="broadcast-delivery" title="How and when" description={copy.deliveryDescription}>
					<fieldset className="flex flex-col gap-2">
						<legend className="mb-2 text-sm font-medium text-foreground">Send it</legend>
						<div className="flex flex-wrap gap-2">
							{BROADCAST_CHANNEL_OPTIONS.map((channel): React.JSX.Element => (
								<ChannelCheckbox key={channel} channel={channel} checked={values.channels.includes(channel)} onToggle={handleChannelToggle} disabled={isSaving} />
							))}
						</div>
						<FieldError field="channels" message={errors.channels} />
					</fieldset>
					<div className="flex flex-col gap-3">
						<p id="timing-label" className="text-sm font-medium text-foreground">
							When
						</p>
						<RadioGroup aria-labelledby="timing-label" value={values.timing} onValueChange={handleTimingChange} disabled={isSaving} className="grid gap-2 sm:grid-cols-3">
							{timingOptions.map((option): React.JSX.Element => (
								<Label key={option.value} className={BROADCAST_CHOICE_SURFACE_CLASS}>
									<RadioGroupItem value={option.value} className="mt-0.5" />
									<span className="flex flex-col gap-0.5">
										<span className="text-sm font-medium text-foreground">{option.label}</span>
										<span className="text-xs text-muted-foreground">{option.hint}</span>
									</span>
								</Label>
							))}
						</RadioGroup>
						{values.timing === "now" ? null : (
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="flex flex-col gap-2">
									<Label htmlFor="sendDate">Date</Label>
									<DatePicker id="sendDate" value={values.sendDate} onValueChange={handleDateChange} disabled={isSaving} placeholder="Pick a date" />
								</div>
								<div className="flex flex-col gap-2">
									<Label id="sendTime-label">Time</Label>
									<TimePicker value={values.sendTime} onValueChange={handleTimeChange} disabled={isSaving} aria-labelledby="sendTime-label" hourCycle={24} minuteStep={5} />
								</div>
							</div>
						)}
						<FieldError field="schedule" message={errors.schedule} />
					</div>
				</ComposerSection>
			</Card>

			<aside className="flex flex-col gap-3 lg:sticky lg:top-20" aria-label="Preview">
				<p className="text-sm font-medium text-muted-foreground">{copy.previewHeading}</p>
				<Card className="gap-3 px-5 py-4">
					<p className="text-base font-semibold text-foreground">{values.title.trim().length === 0 ? "Your title" : values.title}</p>
					{values.body === null ? <p className="text-sm text-muted-foreground">Your message appears here as you write.</p> : <RichTextView document={values.body} />}
				</Card>
				{sendDisabledReason === null ? null : <p className="text-xs text-muted-foreground">{sendDisabledReason}</p>}
				<div className="grid grid-cols-2 gap-2">
					<Button type="submit" value="draft" variant="outline" disabled={isSaving}>
						{savingIntent === "draft" ? <Spinner className="size-4" aria-hidden="true" /> : null}
						{savingIntent === "draft" ? "Saving…" : "Save draft"}
					</Button>
					<Button type="submit" value="send" disabled={isSaving || sendDisabledReason !== null}>
						{savingIntent === "send" ? <Spinner className="size-4" aria-hidden="true" /> : null}
						{savingIntent === "send" ? "Sending…" : values.timing === "now" ? "Send" : "Schedule"}
					</Button>
				</div>
				{cancel}
			</aside>
		</form>
	);
}

interface ComposerSectionProps {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly children: React.ReactNode;
}

/** One part of the composer's panel: a heading and a line on what it is for, then its fields. */
function ComposerSection({ id, title, description, children }: ComposerSectionProps): React.JSX.Element {
	const headingId = `${id}-heading`;
	return (
		<section id={id} aria-labelledby={headingId} className="flex scroll-mt-24 flex-col gap-5 border-border px-5 py-6 not-first:border-t sm:px-7 sm:py-7">
			<header className="flex flex-col gap-1">
				<h2 id={headingId} className="text-base font-semibold text-foreground">
					{title}
				</h2>
				<p className="text-sm text-muted-foreground">{description}</p>
			</header>
			{children}
		</section>
	);
}

function errorIdOf(field: string): string {
	return `${field}-error`;
}

function fieldErrorProps(field: string, message: string | undefined): Pick<React.AriaAttributes, "aria-invalid" | "aria-describedby"> {
	return message === undefined ? {} : { "aria-invalid": true, "aria-describedby": errorIdOf(field) };
}

/** A field's message, announced as it appears. */
export function FieldError({ field, message }: { readonly field: string; readonly message: string | undefined }): React.JSX.Element | null {
	if (message === undefined) {
		return null;
	}
	return (
		<p id={errorIdOf(field)} role="alert" className="text-sm text-destructive">
			{message}
		</p>
	);
}

interface ChannelCheckboxProps {
	readonly channel: BroadcastChannel;
	readonly checked: boolean;
	readonly onToggle: (channel: BroadcastChannel, checked: boolean) => void;
	readonly disabled: boolean;
}

function ChannelCheckbox({ channel, checked, onToggle, disabled }: ChannelCheckboxProps): React.JSX.Element {
	const handleChange = React.useCallback(
		(next: boolean): void => {
			onToggle(channel, next);
		},
		[channel, onToggle],
	);
	return (
		<Label className={BROADCAST_CHOICE_SURFACE_CLASS}>
			<Checkbox checked={checked} onCheckedChange={handleChange} disabled={disabled} className="mt-0.5" />
			<span className="text-sm text-foreground">{BROADCAST_CHANNEL_LABELS[channel]}</span>
		</Label>
	);
}
