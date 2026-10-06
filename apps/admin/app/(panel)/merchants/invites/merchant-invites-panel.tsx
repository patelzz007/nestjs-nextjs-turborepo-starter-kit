"use client";

import { useForm, useSelector } from "@tanstack/react-form";
import { useAuth } from "@workspace/client/lib/auth";
import { useAuthorization } from "@workspace/client/lib/auth/can";
import {
	AdminCreateMerchantInviteSchema,
	EmailTemplateKeySchema,
	PERMISSION,
	PilotCitySchema,
	type AdminCreateMerchantInviteInput,
	type AdminMerchantInviteCreatedResponse,
	type EmailPreview,
	type PilotCity,
} from "@workspace/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Badge } from "@workspace/ui/components/badge";
import { toastMessage } from "@workspace/ui/components/toast";
import { Button } from "@workspace/ui/components/button";
import { Copy, Eye, Send } from "lucide-react";
import * as React from "react";

import { OptionSelectField, TextField, useFormSubmitHandler } from "@/components/common/form-fields";
import EmailPreviewCard from "@/components/email/email-preview-card";
import { toastMutationError } from "@/lib/api/mutation-error";
import { formatDateTime } from "@/lib/format/dates";
import { pilotCityLabel } from "@/lib/format/pilot-city";
import { ROUTES } from "@/lib/routes";

/** What a submit of the invite form does. */
type InviteIntent = "preview" | "send";

interface InviteSubmitMeta {
	readonly intent: InviteIntent;
}

/** Preselected pilot city — the first entry of the shared enum, referenced through it rather than typed by hand. */
const DEFAULT_INVITE_CITY: PilotCity = PilotCitySchema.enum.KUALA_LUMPUR;

const DEFAULT_INVITE_VALUES: AdminCreateMerchantInviteInput = {
	email: "",
	businessName: "",
	city: DEFAULT_INVITE_CITY,
};

const PREVIEW_INTENT: InviteSubmitMeta = { intent: "preview" };
const SEND_INTENT: InviteSubmitMeta = { intent: "send" };

/** The template the invite email is rendered from (opened from the preview card). */
const MERCHANT_INVITE_TEMPLATE_KEY = EmailTemplateKeySchema.enum["merchant-invite"];

/** Stable identity of a form state — the send button is enabled only for the exact values that were previewed. */
function inviteFingerprint(input: AdminCreateMerchantInviteInput): string {
	return JSON.stringify([input.email.trim(), input.businessName.trim(), input.city]);
}

export default function MerchantInvitesPanel(): React.JSX.Element {
	const { api } = useAuth();
	const { can } = useAuthorization();
	const [lastInvite, setLastInvite] = React.useState<AdminMerchantInviteCreatedResponse | null>(null);
	const [preview, setPreview] = React.useState<EmailPreview | undefined>(undefined);
	const [previewedFingerprint, setPreviewedFingerprint] = React.useState<string | null>(null);

	const previewInvite = api.rewardsAdmin.previewInviteEmail.useMutation({
		onError: (error) => {
			toastMutationError("Preview failed", error);
		},
	});

	const createInvite = api.rewardsAdmin.createInvite.useMutation({
		onError: (error) => {
			toastMutationError("Invite failed", error);
		},
	});

	const form = useForm({
		defaultValues: DEFAULT_INVITE_VALUES,
		validators: { onSubmit: AdminCreateMerchantInviteSchema },
		onSubmitMeta: PREVIEW_INTENT,
		onSubmit: ({ value, meta, formApi }): void => {
			const input: AdminCreateMerchantInviteInput = AdminCreateMerchantInviteSchema.parse(value);
			if (meta.intent === "preview") {
				previewInvite.mutate(input, {
					onSuccess: (response) => {
						setPreview(response.data);
						setPreviewedFingerprint(inviteFingerprint(input));
					},
				});
				return;
			}
			createInvite.mutate(input, {
				onSuccess: (response) => {
					setLastInvite(response.data);
					toastMessage.success({ title: "Invite sent", description: "The merchant received the onboarding email." });
					formApi.reset();
					setPreview(undefined);
					setPreviewedFingerprint(null);
				},
			});
		},
	});

	const values = useSelector(form.store, (state) => state.values);
	const isPreviewCurrent = previewedFingerprint !== null && previewedFingerprint === inviteFingerprint(values);
	const isBusy = previewInvite.isPending || createInvite.isPending;

	const submitPreview = React.useCallback((): Promise<void> => form.handleSubmit(PREVIEW_INTENT), [form]);
	const handleFormSubmit = useFormSubmitHandler(submitPreview);

	const handleSend = React.useCallback((): void => {
		void form.handleSubmit(SEND_INTENT);
	}, [form]);

	const handleCopyToken = React.useCallback((): void => {
		if (lastInvite === null) {
			return;
		}
		navigator.clipboard.writeText(lastInvite.inviteToken).then(
			(): void => {
				toastMessage.success({ title: "Copied", description: "Invite token copied to clipboard." });
			},
			(): void => {
				toastMessage.error({ title: "Copy failed", description: "The browser blocked clipboard access. Select the token and copy it manually." });
			},
		);
	}, [lastInvite]);

	return (
		<div className="mx-auto flex w-full flex-col gap-6">
			<header>
				<h1 className="text-2xl font-semibold tracking-tight">Merchant invites</h1>
				<p className="text-sm text-muted-foreground">Preview the invite email, then send it through Resend. The token is also shown after send for manual sharing.</p>
			</header>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
				<Card>
					<CardHeader>
						<CardTitle>New invite</CardTitle>
						<CardDescription>Step 1: preview with your details. Step 2: create invite and email the merchant.</CardDescription>
					</CardHeader>
					<CardContent>
						<form noValidate className="space-y-4" onSubmit={handleFormSubmit}>
							<form.Field name="email">
								{(field) => (
									<TextField
										id="invite-email"
										label="Contact email"
										type="email"
										placeholder="owner@cafe.demo"
										value={field.state.value}
										onChange={field.handleChange}
										onBlur={field.handleBlur}
										errors={field.state.meta.errors}
									/>
								)}
							</form.Field>
							<form.Field name="businessName">
								{(field) => (
									<TextField
										id="invite-business"
										label="Business name"
										placeholder="Sunrise Café"
										value={field.state.value}
										onChange={field.handleChange}
										onBlur={field.handleBlur}
										errors={field.state.meta.errors}
									/>
								)}
							</form.Field>
							<form.Field name="city">
								{(field) => (
									<OptionSelectField
										id="invite-city"
										label="Pilot city"
										value={field.state.value}
										options={PilotCitySchema.options}
										labelOf={pilotCityLabel}
										onChange={field.handleChange}
										errors={field.state.meta.errors}
									/>
								)}
							</form.Field>
							<div className="flex flex-wrap gap-2">
								<Button type="submit" variant="outline" disabled={isBusy}>
									<Eye className="mr-2 size-4" />
									{previewInvite.isPending ? "Rendering…" : "Preview email"}
								</Button>
								<Button type="button" disabled={isBusy || !isPreviewCurrent} onClick={handleSend}>
									<Send className="mr-2 size-4" />
									{createInvite.isPending ? "Sending…" : "Create & send invite"}
								</Button>
							</div>
							{!isPreviewCurrent ? <p className="text-xs text-muted-foreground">Preview the email with the current details to enable sending.</p> : null}
						</form>
					</CardContent>
				</Card>

				<EmailPreviewCard
					preview={preview}
					isLoading={previewInvite.isPending}
					footerNote="Preview links use a placeholder token until you send the invite."
					templatesHref={can(PERMISSION.EMAIL.READ) ? ROUTES.emails.template(MERCHANT_INVITE_TEMPLATE_KEY) : undefined}
				/>
			</div>

			{lastInvite !== null ? (
				<Card>
					<CardHeader>
						<CardTitle>Latest invite</CardTitle>
						<CardDescription>Share the token securely if the merchant cannot use the email link.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="flex flex-wrap items-center gap-2">
							<Badge variant="outline">Expires {formatDateTime(lastInvite.expiresAt)}</Badge>
							<Badge variant="secondary" className="font-mono text-xs">
								{lastInvite.inviteId}
							</Badge>
						</div>
						<div className="rounded-md border bg-muted/40 p-3 font-mono text-sm break-all">{lastInvite.inviteToken}</div>
						<Button type="button" variant="outline" size="sm" onClick={handleCopyToken}>
							<Copy className="mr-2 size-4" />
							Copy token
						</Button>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
