"use client";

import { WEBHOOK_EVENT_CHOICES, type WebhookEndpointFormValues } from "@/contexts/webhooks/lib/webhook-presentation";
import { WEBHOOK_ENDPOINT_DESCRIPTION_MAX_LENGTH, WEBHOOK_ENDPOINT_URL_MAX_LENGTH, type WebhookSubscribableEventType } from "@workspace/shared";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import * as React from "react";

/** The same choice surface as the reward editor's store picker. */
const CHOICE_CLASS =
	"flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3 font-normal transition-colors duration-150 hover:border-foreground/20 has-data-checked:border-primary has-data-checked:bg-primary/5 has-data-disabled:cursor-not-allowed has-data-disabled:opacity-60 motion-reduce:transition-none dark:has-data-checked:bg-primary/10";

interface EventChoiceProps {
	readonly type: WebhookSubscribableEventType;
	readonly description: string;
	readonly checked: boolean;
	readonly disabled: boolean;
	readonly onToggle: (type: WebhookSubscribableEventType, checked: boolean) => void;
}

function EventChoice({ type, description, checked, disabled, onToggle }: EventChoiceProps): React.JSX.Element {
	const handleCheckedChange = React.useCallback(
		(next: boolean): void => {
			onToggle(type, next);
		},
		[onToggle, type],
	);
	return (
		<Label className={CHOICE_CLASS}>
			<Checkbox checked={checked} onCheckedChange={handleCheckedChange} disabled={disabled} className="mt-0.5" />
			<span className="flex min-w-0 flex-col gap-0.5">
				<span className="font-mono text-sm text-foreground">{type}</span>
				<span className="text-xs text-muted-foreground">{description}</span>
			</span>
		</Label>
	);
}

export interface WebhookEndpointFieldsProps {
	readonly values: WebhookEndpointFormValues;
	readonly disabled: boolean;
	readonly onUrlChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	readonly onDescriptionChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
	readonly onEventToggle: (type: WebhookSubscribableEventType, checked: boolean) => void;
}

/** An endpoint's address, its note and the events it receives. Controlled and data-agnostic: the page owns the values. */
export function WebhookEndpointFields({ values, disabled, onUrlChange, onDescriptionChange, onEventToggle }: WebhookEndpointFieldsProps): React.JSX.Element {
	const selected = new Set(values.eventTypes);
	return (
		<div className="space-y-5">
			<div className="space-y-1.5">
				<Label htmlFor="webhook-url">Endpoint URL</Label>
				<Input
					id="webhook-url"
					type="url"
					inputMode="url"
					placeholder="https://example.com/webhooks"
					value={values.url}
					onChange={onUrlChange}
					disabled={disabled}
					maxLength={WEBHOOK_ENDPOINT_URL_MAX_LENGTH}
					required
					aria-describedby="webhook-url-hint"
				/>
				<p id="webhook-url-hint" className="text-xs text-muted-foreground">
					Must use HTTPS and be reachable from the internet. Your server should answer with a 2xx status within 10 seconds.
				</p>
			</div>
			<div className="space-y-1.5">
				<Label htmlFor="webhook-description">Description (optional)</Label>
				<Input
					id="webhook-description"
					placeholder="What receives these events, e.g. Order system"
					value={values.description}
					onChange={onDescriptionChange}
					disabled={disabled}
					maxLength={WEBHOOK_ENDPOINT_DESCRIPTION_MAX_LENGTH}
				/>
			</div>
			<fieldset className="space-y-2">
				<legend className="text-sm font-medium text-foreground">Events to send</legend>
				<p className="text-xs text-muted-foreground">Choose at least one. You can change this later.</p>
				<div className="grid gap-2 sm:grid-cols-2">
					{WEBHOOK_EVENT_CHOICES.map((choice) => (
						<EventChoice
							key={choice.type}
							type={choice.type}
							description={choice.description}
							checked={selected.has(choice.type)}
							disabled={disabled}
							onToggle={onEventToggle}
						/>
					))}
				</div>
			</fieldset>
		</div>
	);
}

/** The field handlers a form needs around {@link WebhookEndpointFields}, over one state setter. */
export function useWebhookEndpointFieldHandlers(
	setValues: React.Dispatch<React.SetStateAction<WebhookEndpointFormValues>>,
	toggle: (values: WebhookEndpointFormValues, type: WebhookSubscribableEventType, checked: boolean) => WebhookEndpointFormValues,
): Pick<WebhookEndpointFieldsProps, "onUrlChange" | "onDescriptionChange" | "onEventToggle"> {
	const onUrlChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			const url = event.target.value;
			setValues((current) => ({ ...current, url }));
		},
		[setValues],
	);
	const onDescriptionChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			const description = event.target.value;
			setValues((current) => ({ ...current, description }));
		},
		[setValues],
	);
	const onEventToggle = React.useCallback(
		(type: WebhookSubscribableEventType, checked: boolean): void => {
			setValues((current) => toggle(current, type, checked));
		},
		[setValues, toggle],
	);
	return { onUrlChange, onDescriptionChange, onEventToggle };
}
