"use client";

import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { Label } from "@workspace/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { Separator } from "@workspace/ui/components/separator";
import { Switch } from "@workspace/ui/components/switch";
import { Textarea } from "@workspace/ui/components/textarea";
import { Save } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { SessionStatusBadge } from "@/components/common/session-status-badge";

/** Profile form state — lives at the page level (smart component owns the data). */
interface ProfileFormState {
	readonly fullName: string;
	readonly email: string;
	readonly company: string;
	readonly bio: string;
}

/** A single notification preference toggle. */
interface TogglePreference {
	readonly key: string;
	readonly label: string;
	readonly description: string;
	readonly enabled: boolean;
}

const initialProfile: ProfileFormState = {
	fullName: "Alex Morgan",
	email: "alex@acme.com",
	company: "Acme Inc.",
	bio: "Product lead at Acme Inc. Building tools for modern teams.",
};

const initialPreferences: readonly TogglePreference[] = [
	{ key: "product-updates", label: "Product updates", description: "News about new features and improvements.", enabled: true },
	{ key: "security-alerts", label: "Security alerts", description: "Important notifications about your account security.", enabled: true },
	{ key: "marketing-emails", label: "Marketing emails", description: "Occasional tips and best-practice content.", enabled: false },
];

const TIMEZONES: readonly string[] = ["UTC", "America/New_York", "Europe/London", "Asia/Kuala_Lumpur", "Asia/Singapore", "Australia/Sydney"];

/** A single preference row — dumb component; data and toggling flow in via props. */
function PreferenceRow({ preference, onToggle }: { readonly preference: TogglePreference; readonly onToggle: (key: string, checked: boolean) => void }): React.JSX.Element {
	const handleCheckedChange = React.useCallback(
		(checked: boolean): void => {
			onToggle(preference.key, checked);
		},
		[onToggle, preference.key],
	);

	return (
		<div className="flex items-center justify-between gap-4 py-3">
			<div className="min-w-0">
				<p className="text-sm font-medium text-foreground">{preference.label}</p>
				<p className="mt-0.5 text-xs text-muted-foreground">{preference.description}</p>
			</div>
			<Switch checked={preference.enabled} onCheckedChange={handleCheckedChange} aria-label={preference.label} />
		</div>
	);
}

export default function GeneralSettingsPage(): React.JSX.Element {
	const [profile, setProfile] = React.useState<ProfileFormState>(initialProfile);
	const [preferences, setPreferences] = React.useState<readonly TogglePreference[]>(initialPreferences);
	const [timezone, setTimezone] = React.useState<string>("Asia/Kuala_Lumpur");

	const handleProfileFieldChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): void => {
		const field = event.currentTarget.dataset.field;
		if (field === "fullName" || field === "email" || field === "company" || field === "bio") {
			setProfile((previous) => ({ ...previous, [field]: event.target.value }));
		}
	}, []);

	const handlePreferenceToggle = React.useCallback((key: string, checked: boolean): void => {
		setPreferences((previous) => previous.map((preference) => (preference.key === key ? { ...preference, enabled: checked } : preference)));
	}, []);

	const handleTimezoneChange = React.useCallback((value: string | null): void => {
		if (value !== null) {
			setTimezone(value);
		}
	}, []);

	const handleSaveProfile = React.useCallback((): void => {
		toast.success("Profile saved", { description: "Your profile changes have been saved." });
	}, []);

	return (
		<div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">General Settings</h1>
				<p className="mt-1 text-sm text-muted-foreground">Manage your account profile and notification preferences.</p>
				{/* Live session check — fires GET /session on every SPA navigation so the
				   silent refresh is observable (see session-status-badge.tsx). */}
				<div className="mt-3">
					<SessionStatusBadge />
				</div>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
				{/* Profile */}
				<Card className="lg:col-span-2">
					<CardHeader>
						<CardTitle>Profile</CardTitle>
						<CardDescription>This is how others will see you on the platform.</CardDescription>
					</CardHeader>
					<CardContent className="space-y-5">
						<div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="full-name">Full name</Label>
								<Input id="full-name" data-field="fullName" value={profile.fullName} onChange={handleProfileFieldChange} placeholder="Jane Doe" />
							</div>
							<div className="space-y-2">
								<Label htmlFor="email">Email</Label>
								<Input id="email" type="email" data-field="email" value={profile.email} onChange={handleProfileFieldChange} placeholder="jane@acme.com" />
							</div>
						</div>
						<div className="space-y-2">
							<Label htmlFor="company">Company</Label>
							<Input id="company" data-field="company" value={profile.company} onChange={handleProfileFieldChange} placeholder="Acme Inc." />
						</div>
						<div className="space-y-2">
							<Label htmlFor="bio">Bio</Label>
							<Textarea id="bio" data-field="bio" value={profile.bio} onChange={handleProfileFieldChange} placeholder="Tell us a little about yourself" />
						</div>
						<div className="space-y-2">
							<Label htmlFor="timezone">Timezone</Label>
							<Select value={timezone} onValueChange={handleTimezoneChange}>
								<SelectTrigger id="timezone" className="w-full sm:w-64" aria-label="Select timezone">
									<SelectValue placeholder="Select timezone" />
								</SelectTrigger>
								<SelectContent>
									{TIMEZONES.map((zone) => (
										<SelectItem key={zone} value={zone} className="rounded-lg">
											{zone}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="flex items-center gap-3 pt-2">
							<Button type="button" onClick={handleSaveProfile}>
								<Save />
								Save changes
							</Button>
						</div>
					</CardContent>
				</Card>

				{/* Notifications */}
				<Card>
					<CardHeader>
						<CardTitle>Notifications</CardTitle>
						<CardDescription>Choose what you want to be notified about.</CardDescription>
					</CardHeader>
					<CardContent>
						<Separator className="-mx-6 mb-1 w-[calc(100%+3rem)]" />
						<div className="divide-y divide-border/60">
							{preferences.map((preference) => (
								<PreferenceRow key={preference.key} preference={preference} onToggle={handlePreferenceToggle} />
							))}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
