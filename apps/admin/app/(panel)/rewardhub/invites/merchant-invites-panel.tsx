"use client";

import EmailPreviewCard from "@/components/email/email-preview-card";
import { useAuth } from "@workspace/client/lib/auth";
import { PilotCitySchema, type AdminMerchantInviteCreatedResponse, type EmailPreview, type PilotCity } from "@workspace/shared";
import { Badge } from "@workspace/ui/components/feedback/badge";
import { Button } from "@workspace/ui/components/form/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/display/card";
import { Input } from "@workspace/ui/components/form/input";
import { Label } from "@workspace/ui/components/form/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/form/select";
import { toastMessage } from "@workspace/ui/components/feedback/toast";
import { Copy, Eye, Send } from "lucide-react";
import * as React from "react";

const PILOT_CITIES: readonly PilotCity[] = PilotCitySchema.options;

function formatEpochMs(value: number): string {
	return new Date(value).toLocaleString();
}

export interface MerchantInvitesPanelProps {
	readonly initialSamplePreview?: EmailPreview;
}

export default function MerchantInvitesPanel({ initialSamplePreview }: MerchantInvitesPanelProps): React.JSX.Element {
	const { api } = useAuth();
	const [email, setEmail] = React.useState<string>("");
	const [businessName, setBusinessName] = React.useState<string>("");
	const [city, setCity] = React.useState<PilotCity>("KUALA_LUMPUR");
	const [lastInvite, setLastInvite] = React.useState<AdminMerchantInviteCreatedResponse | null>(null);
	const [preview, setPreview] = React.useState<EmailPreview | undefined>(initialSamplePreview);
	const [previewReady, setPreviewReady] = React.useState<boolean>(initialSamplePreview !== undefined);

	const previewInvite = api.rewardsAdmin.previewInviteEmail.useMutation({
		onSuccess: (response) => {
			setPreview(response.data);
			setPreviewReady(true);
		},
		onError: (error) => {
			toastMessage.error({ title: "Preview failed", description: error.message });
		},
	});

	const createInvite = api.rewardsAdmin.createInvite.useMutation({
		onSuccess: (response) => {
			setLastInvite(response.data);
			toastMessage.success({ title: "Invite sent", description: "The merchant received the onboarding email." });
			setEmail("");
			setBusinessName("");
			setPreviewReady(false);
			setPreview(initialSamplePreview);
		},
		onError: (error) => {
			toastMessage.error({ title: "Invite failed", description: error.message });
		},
	});

	const handleEmailChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setEmail(event.target.value);
		setPreviewReady(false);
	}, []);

	const handleBusinessNameChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setBusinessName(event.target.value);
		setPreviewReady(false);
	}, []);

	const handleCityChange = React.useCallback((value: string | null): void => {
		const parsed = PilotCitySchema.safeParse(value);
		if (parsed.success) {
			setCity(parsed.data);
			setPreviewReady(false);
		}
	}, []);

	const buildFormInput = React.useCallback((): { email: string; businessName: string; city: PilotCity } | null => {
		const trimmedEmail = email.trim();
		const trimmedBusiness = businessName.trim();
		if (trimmedEmail.length === 0 || trimmedBusiness.length === 0) {
			toastMessage.error({ title: "Missing fields", description: "Enter email and business name before continuing." });
			return null;
		}
		return { email: trimmedEmail, businessName: trimmedBusiness, city };
	}, [businessName, city, email]);

	const handlePreview = React.useCallback((): void => {
		const input = buildFormInput();
		if (input === null) {
			return;
		}
		previewInvite.mutate(input);
	}, [buildFormInput, previewInvite]);

	const handleSendInvite = React.useCallback((): void => {
		if (!previewReady) {
			toastMessage.error({ title: "Preview required", description: "Preview the email with your form data before sending." });
			return;
		}
		const input = buildFormInput();
		if (input === null) {
			return;
		}
		createInvite.mutate(input);
	}, [buildFormInput, createInvite, previewReady]);

	const handleCopyToken = React.useCallback(async (): Promise<void> => {
		if (lastInvite === null) {
			return;
		}
		await navigator.clipboard.writeText(lastInvite.inviteToken);
		toastMessage.success({ title: "Copied", description: "Invite token copied to clipboard." });
	}, [lastInvite]);

	const handleCopyTokenClick = React.useCallback((): void => {
		void handleCopyToken();
	}, [handleCopyToken]);

	const isBusy = previewInvite.isPending || createInvite.isPending;

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
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="invite-email">Contact email</Label>
							<Input id="invite-email" type="email" value={email} onChange={handleEmailChange} placeholder="owner@cafe.demo" required />
						</div>
						<div className="space-y-2">
							<Label htmlFor="invite-business">Business name</Label>
							<Input id="invite-business" value={businessName} onChange={handleBusinessNameChange} placeholder="Sunrise Café" required />
						</div>
						<div className="space-y-2">
							<Label htmlFor="invite-city">Pilot city</Label>
							<Select value={city} onValueChange={handleCityChange}>
								<SelectTrigger id="invite-city">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{PILOT_CITIES.map((option) => (
										<SelectItem key={option} value={option}>
											{option.replace("_", " ")}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex flex-wrap gap-2">
							<Button type="button" variant="outline" disabled={isBusy} onClick={handlePreview}>
								<Eye className="mr-2 size-4" />
								{previewInvite.isPending ? "Rendering…" : "Preview email"}
							</Button>
							<Button type="button" disabled={isBusy || !previewReady} onClick={handleSendInvite}>
								<Send className="mr-2 size-4" />
								{createInvite.isPending ? "Sending…" : "Create & send invite"}
							</Button>
						</div>
					</CardContent>
				</Card>

				<EmailPreviewCard
					preview={preview}
					isLoading={previewInvite.isPending}
					footerNote="Preview links use a placeholder token until you send the invite."
					templatesHref="/emails?key=merchant-invite"
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
							<Badge variant="outline">Expires {formatEpochMs(lastInvite.expiresAt)}</Badge>
							<Badge variant="secondary" className="font-mono text-xs">
								{lastInvite.inviteId}
							</Badge>
						</div>
						<div className="rounded-md border bg-muted/40 p-3 font-mono text-sm break-all">{lastInvite.inviteToken}</div>
						<Button type="button" variant="outline" size="sm" onClick={handleCopyTokenClick}>
							<Copy className="mr-2 size-4" />
							Copy token
						</Button>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
