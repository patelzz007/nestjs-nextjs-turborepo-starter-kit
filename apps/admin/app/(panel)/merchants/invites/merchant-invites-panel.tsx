"use client";

import { keepPreviousData } from "@tanstack/react-query";
import { useForm, useSelector } from "@tanstack/react-form";
import { useAuth } from "@workspace/client/lib/auth";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import {
	AdminCreateMerchantInviteSchema,
	AdminMerchantInvitePreviewQuerySchema,
	EmailTemplateKeySchema,
	PERMISSION,
	PilotCitySchema,
	type AdminCreateMerchantInviteInput,
	type AdminMerchantInviteCreatedResponse,
	type AdminMerchantInvitePreviewQuery,
	type PilotCity,
} from "@workspace/shared";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";
import { toastMessage } from "@workspace/ui/components/toast";
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group";
import { useDebouncedValue } from "@workspace/ui/hooks/use-debounced-value";
import { CheckCircle2, Copy, Send } from "lucide-react";
import * as React from "react";

import { useFormSubmitHandler, type FormFieldError } from "@/components/common/form-fields";
import { EmailInboxPreview, type EmailPreviewDevice, type EmailPreviewStatus } from "@/components/email/email-inbox-preview";
import { toastMutationError } from "@/lib/api/mutation-error";
import { formatDateTime } from "@/lib/format/dates";
import { pilotCityLabel } from "@/lib/format/pilot-city";
import { ROUTES } from "@/lib/routes";

/** Preselected pilot city — the first entry of the shared enum, referenced through it rather than typed by hand. */
const DEFAULT_INVITE_CITY: PilotCity = PilotCitySchema.enum.KUALA_LUMPUR;

const DEFAULT_INVITE_VALUES: AdminCreateMerchantInviteInput = {
	email: "",
	businessName: "",
	city: DEFAULT_INVITE_CITY,
};

/** Quiet time after the last keystroke before the email is re-rendered — fast enough to feel live, one request per pause. */
const PREVIEW_DEBOUNCE_MS = 350;

/** The template the invite email is rendered from (opened from the preview). */
const MERCHANT_INVITE_TEMPLATE_KEY = EmailTemplateKeySchema.enum["merchant-invite"];

/** What the preview renders for the current form: the typed business name once it is a valid one, and the city. */
function toPreviewQuery(businessName: string, city: PilotCity): AdminMerchantInvitePreviewQuery {
	const trimmed = businessName.trim();
	const withName = AdminMerchantInvitePreviewQuerySchema.safeParse({ businessName: trimmed, city });
	return withName.success && trimmed.length > 0 ? withName.data : { city };
}

/** Errors of a field once the admin has left it — not while they are still typing their first value. */
function visibleErrors(hasBeenLeft: boolean, errors: readonly FormFieldError[]): readonly FormFieldError[] {
	return hasBeenLeft ? errors : [];
}

interface ComposeRowProps {
	readonly id: string;
	readonly label: string;
	readonly errors: readonly FormFieldError[];
	readonly children: React.ReactNode;
}

/** One line of the compose box: an inline label, the control, and its validation message. */
function ComposeRow({ id, label, errors, children }: ComposeRowProps): React.JSX.Element {
	const messages = errors.flatMap((error) => (error?.message === undefined ? [] : [error.message]));
	return (
		<div className="px-4 py-2.5 transition-colors focus-within:bg-muted/40">
			<div className="flex items-center gap-3">
				<label id={`${id}-label`} htmlFor={id} className="w-20 shrink-0 text-sm text-muted-foreground">
					{label}
				</label>
				<div className="min-w-0 flex-1">{children}</div>
			</div>
			{messages.length > 0 ? (
				<p id={`${id}-error`} className="ms-23 mt-1 text-xs text-destructive">
					{messages.join(" ")}
				</p>
			) : null}
		</div>
	);
}

/** Borderless input for a compose row — the row is the field; focus still shows a ring. */
const COMPOSE_INPUT_CLASS = "h-8 border-transparent bg-transparent px-2 shadow-none dark:bg-transparent";

interface ComposeTextFieldProps {
	readonly id: string;
	readonly label: string;
	readonly value: string;
	readonly placeholder: string;
	readonly type?: "text" | "email";
	/** The admin has left the field at least once — from then on its errors stay visible and current. */
	readonly hasBeenLeft: boolean;
	readonly errors: readonly FormFieldError[];
	readonly onChange: (value: string) => void;
	readonly onBlur: () => void;
}

/** A text line of the compose box; its errors appear once the admin has left it. */
function ComposeTextField({ id, label, value, placeholder, type = "text", hasBeenLeft, errors, onChange, onBlur }: ComposeTextFieldProps): React.JSX.Element {
	const shownErrors = visibleErrors(hasBeenLeft, errors);
	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>): void => {
			onChange(event.target.value);
		},
		[onChange],
	);
	return (
		<ComposeRow id={id} label={label} errors={shownErrors}>
			<Input
				id={id}
				type={type}
				autoComplete="off"
				placeholder={placeholder}
				value={value}
				aria-invalid={shownErrors.length > 0}
				aria-describedby={shownErrors.length > 0 ? `${id}-error` : undefined}
				onBlur={onBlur}
				onChange={handleChange}
				className={COMPOSE_INPUT_CLASS}
			/>
		</ComposeRow>
	);
}

interface PilotCityChoiceProps {
	readonly id: string;
	readonly value: PilotCity;
	readonly onChange: (city: PilotCity) => void;
}

/** The pilot cities as one segmented choice — there are few enough to show them all. */
function PilotCityChoice({ id, value, onChange }: PilotCityChoiceProps): React.JSX.Element {
	const handleValueChange = React.useCallback(
		(next: readonly string[]): void => {
			const city = PilotCitySchema.safeParse(next.find((candidate) => candidate !== value));
			if (city.success) {
				onChange(city.data);
			}
		},
		[onChange, value],
	);
	return (
		<ComposeRow id={id} label="Pilot city" errors={[]}>
			<ToggleGroup id={id} multiple={false} value={[value]} onValueChange={handleValueChange} variant="outline" size="sm" spacing={0} aria-labelledby={`${id}-label`}>
				{PilotCitySchema.options.map((city) => (
					<ToggleGroupItem key={city} value={city} className="px-3">
						{pilotCityLabel(city)}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
		</ComposeRow>
	);
}

export default function MerchantInvitesPanel(): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const [lastInvite, setLastInvite] = React.useState<{ readonly sentTo: string; readonly invite: AdminMerchantInviteCreatedResponse } | null>(null);
	const [device, setDevice] = React.useState<EmailPreviewDevice>("desktop");

	const createInvite = api.rewardsAdmin.createInvite.useMutation({
		onError: (error) => {
			toastMutationError("Invite not sent", error);
		},
	});

	const form = useForm({
		defaultValues: DEFAULT_INVITE_VALUES,
		// Validated on every change so errors are never stale; a field shows them only once it has been left.
		validators: { onChange: AdminCreateMerchantInviteSchema, onSubmit: AdminCreateMerchantInviteSchema },
		onSubmit: ({ value, formApi }): void => {
			const input: AdminCreateMerchantInviteInput = AdminCreateMerchantInviteSchema.parse(value);
			createInvite.mutate(input, {
				onSuccess: (response) => {
					setLastInvite({ sentTo: input.email, invite: response.data });
					toastMessage.success({ title: "Invite sent", description: `${input.businessName} will get the onboarding email at ${input.email}.` });
					formApi.reset();
				},
			});
		},
	});

	const values = useSelector(form.store, (state) => state.values);
	const canSend = AdminCreateMerchantInviteSchema.safeParse(values).success;

	// The preview follows the form: the business name after a short pause, the city at once.
	const settledBusinessName = useDebouncedValue(values.businessName, PREVIEW_DEBOUNCE_MS);
	const previewQuery = React.useMemo((): AdminMerchantInvitePreviewQuery => toPreviewQuery(settledBusinessName, values.city), [settledBusinessName, values.city]);
	const preview = api.rewardsAdmin.previewInviteEmail.useQuery(previewQuery, { placeholderData: keepPreviousData });
	const isTyping = settledBusinessName !== values.businessName;

	const previewStatus: EmailPreviewStatus = ((): EmailPreviewStatus => {
		if (preview.isError) return "error";
		if (preview.data === undefined) return "loading";
		return preview.isFetching || isTyping ? "updating" : "live";
	})();

	const submitInvite = React.useCallback((): Promise<void> => form.handleSubmit(), [form]);
	const handleSubmit = useFormSubmitHandler(submitInvite);

	const handleRetryPreview = React.useCallback((): void => {
		void preview.refetch();
	}, [preview]);

	const handleCopyToken = React.useCallback((): void => {
		if (lastInvite === null) {
			return;
		}
		navigator.clipboard.writeText(lastInvite.invite.inviteToken).then(
			(): void => {
				toastMessage.success({ title: "Token copied", description: "Share it only with the merchant." });
			},
			(): void => {
				toastMessage.error({ title: "Copy failed", description: "The browser blocked clipboard access. Select the token and copy it manually." });
			},
		);
	}, [lastInvite]);

	return (
		<div className="flex w-full flex-col gap-6">
			<header className="max-w-2xl">
				<h1 className="font-heading text-2xl font-semibold tracking-tight">Merchant invites</h1>
				<p className="mt-1 text-sm text-muted-foreground">The preview is exactly the email the merchant receives, and it updates as you type.</p>
			</header>

			<div className="grid items-start gap-6 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
				<div className="flex flex-col gap-4 lg:sticky lg:top-20">
					{lastInvite !== null ? (
						<section aria-label="Invite sent" className="rounded-xl border bg-card p-4 shadow-sm">
							<div className="flex items-start gap-3">
								<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-tone-green-soft text-tone-green" aria-hidden="true">
									<CheckCircle2 className="size-5" />
								</span>
								<div className="min-w-0 space-y-1">
									<p className="text-sm font-medium">Invite sent to {lastInvite.sentTo}</p>
									<p className="text-xs text-muted-foreground">
										Link expires {formatDateTime(lastInvite.invite.expiresAt)}. If the email does not arrive, share this token with the merchant directly.
									</p>
								</div>
							</div>
							<div className="mt-3 flex items-center gap-2">
								<code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs" title={lastInvite.invite.inviteToken}>
									{lastInvite.invite.inviteToken}
								</code>
								<Button type="button" variant="outline" size="sm" onClick={handleCopyToken}>
									<Copy className="size-4" aria-hidden="true" />
									Copy token
								</Button>
							</div>
						</section>
					) : null}

					<form noValidate onSubmit={handleSubmit} aria-label="New merchant invite" className="overflow-hidden rounded-xl border bg-card shadow-sm">
						<div className="border-b px-4 py-3">
							<h2 className="font-heading text-base font-semibold">New invite</h2>
						</div>
						<div className="divide-y">
							<form.Field name="email">
								{(field) => (
									<ComposeTextField
										id="invite-email"
										label="To"
										type="email"
										placeholder="owner@cafe.demo"
										value={field.state.value}
										hasBeenLeft={field.state.meta.isBlurred}
										errors={field.state.meta.errors}
										onChange={field.handleChange}
										onBlur={field.handleBlur}
									/>
								)}
							</form.Field>
							<form.Field name="businessName">
								{(field) => (
									<ComposeTextField
										id="invite-business"
										label="Business"
										placeholder="Sunrise Café"
										value={field.state.value}
										hasBeenLeft={field.state.meta.isBlurred}
										errors={field.state.meta.errors}
										onChange={field.handleChange}
										onBlur={field.handleBlur}
									/>
								)}
							</form.Field>
							<form.Field name="city">{(field) => <PilotCityChoice id="invite-city" value={field.state.value} onChange={field.handleChange} />}</form.Field>
						</div>
						<div className="flex flex-col gap-2 border-t bg-muted/30 px-4 py-3">
							<Button type="submit" disabled={!canSend || createInvite.isPending} className="w-full">
								<Send className="size-4" aria-hidden="true" />
								{createInvite.isPending ? "Sending…" : "Send invite"}
							</Button>
							<p className="text-center text-xs text-muted-foreground">
								{canSend ? "Sends the email shown here, with a one-time onboarding link." : "Add the merchant's email and business name to send."}
							</p>
						</div>
					</form>
				</div>

				<EmailInboxPreview
					preview={preview.data?.data}
					recipient={values.email.trim()}
					status={previewStatus}
					device={device}
					onDeviceChange={setDevice}
					onRetry={handleRetryPreview}
					templatesHref={can(PERMISSION.EMAIL.READ) ? ROUTES.emails.template(MERCHANT_INVITE_TEMPLATE_KEY) : undefined}
				/>
			</div>
		</div>
	);
}
