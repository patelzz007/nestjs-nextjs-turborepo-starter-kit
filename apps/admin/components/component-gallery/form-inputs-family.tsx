"use client";

import { passwordStrength } from "@workspace/client/lib/contexts/identity/password";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSeparator, FieldSet } from "@workspace/ui/components/field";
import { Input } from "@workspace/ui/components/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText, InputGroupTextarea } from "@workspace/ui/components/input-group";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@workspace/ui/components/input-otp";
import { Label } from "@workspace/ui/components/label";
import { PasswordInput } from "@workspace/ui/components/password-input";
import { PasswordStrengthMeter } from "@workspace/ui/components/password-strength-meter";
import { Textarea } from "@workspace/ui/components/textarea";
import { AtSign, Search, X } from "lucide-react";
import * as React from "react";
import { z } from "zod";

import { GALLERY_ENTRIES } from "@/components/component-gallery/gallery-catalog";
import { ComponentSection, DemoRow, DemoSurface, DemoValue, ExampleOnlySections } from "@/components/component-gallery/gallery-section";

const DemoEmailSchema = z.email();

/** Characters of the demo one-time code. */
const OTP_LENGTH = 6;
/** The demo code accepts digits only. */
const OTP_DIGITS_PATTERN = "^[0-9]+$";
/** Slot positions of each half of the code (`123-456`). */
const OTP_FIRST_HALF: readonly number[] = [0, 1, 2];
const OTP_SECOND_HALF: readonly number[] = [3, 4, 5];

/** The longest bio the demo textarea accepts. */
const BIO_MAX_LENGTH = 160;

function readInputValue(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>): string {
	return event.currentTarget.value;
}

function FieldDemo(): React.JSX.Element {
	const [email, setEmail] = React.useState<string>("not-an-email");
	const [isSubscribed, setIsSubscribed] = React.useState<boolean>(true);
	const isEmailValid = DemoEmailSchema.safeParse(email).success;

	const handleEmailChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setEmail(readInputValue(event));
	}, []);

	return (
		<DemoSurface>
			<FieldSet>
				<FieldLegend>Contact details</FieldLegend>
				<FieldDescription>A fieldset groups related fields under one legend.</FieldDescription>
				<FieldGroup>
					<Field>
						<FieldLabel htmlFor="gallery-field-name">Full name</FieldLabel>
						<Input id="gallery-field-name" defaultValue="Ada Lovelace" aria-describedby="gallery-field-name-hint" />
						<FieldDescription id="gallery-field-name-hint">As it appears on official documents.</FieldDescription>
					</Field>
					<Field data-invalid={isEmailValid ? undefined : true}>
						<FieldLabel htmlFor="gallery-field-email">Email</FieldLabel>
						<Input
							id="gallery-field-email"
							type="email"
							value={email}
							onChange={handleEmailChange}
							aria-invalid={!isEmailValid}
							aria-describedby={isEmailValid ? undefined : "gallery-field-email-error"}
						/>
						{isEmailValid ? null : <FieldError id="gallery-field-email-error">Enter a valid email address — type one to clear the error.</FieldError>}
					</Field>
					<FieldSeparator />
					<Field orientation="horizontal">
						<Checkbox id="gallery-field-subscribe" checked={isSubscribed} onCheckedChange={setIsSubscribed} />
						<FieldContent>
							<FieldLabel htmlFor="gallery-field-subscribe">Product updates</FieldLabel>
							<FieldDescription>A horizontal field puts the control beside its label.</FieldDescription>
						</FieldContent>
					</Field>
				</FieldGroup>
			</FieldSet>
		</DemoSurface>
	);
}

function LabelDemo(): React.JSX.Element {
	return (
		<DemoSurface>
			<DemoRow label="Linked to its control">
				<div className="flex items-center gap-2">
					<Checkbox id="gallery-label-terms" />
					<Label htmlFor="gallery-label-terms">Accept the terms</Label>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="gallery-label-city">City</Label>
					<Input id="gallery-label-city" placeholder="Lisbon" className="w-56" />
				</div>
			</DemoRow>
		</DemoSurface>
	);
}

function InputDemo(): React.JSX.Element {
	const [query, setQuery] = React.useState<string>("");

	const handleQueryChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setQuery(readInputValue(event));
	}, []);

	return (
		<DemoSurface>
			<DemoRow label="Sizes" className="items-start">
				<Input size="sm" placeholder="Small" aria-label="Small input" className="w-48" />
				<Input placeholder="Default" aria-label="Default input" className="w-48" />
				<Input size="lg" placeholder="Large" aria-label="Large input" className="w-48" />
			</DemoRow>
			<DemoRow label="States" className="items-start">
				<Input value={query} onChange={handleQueryChange} placeholder="Controlled" aria-label="Controlled input" className="w-48" />
				<Input loading placeholder="Loading" aria-label="Loading input" className="w-48" />
				<Input disabled placeholder="Disabled" aria-label="Disabled input" className="w-48" />
				<Input aria-invalid defaultValue="Invalid" aria-label="Invalid input" className="w-48" />
			</DemoRow>
			<DemoValue label="Controlled value">{query.length > 0 ? query : "(empty)"}</DemoValue>
		</DemoSurface>
	);
}

function InputGroupDemo(): React.JSX.Element {
	const [search, setSearch] = React.useState<string>("button");

	const handleSearchChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setSearch(readInputValue(event));
	}, []);

	const handleClear = React.useCallback((): void => {
		setSearch("");
	}, []);

	return (
		<DemoSurface>
			<DemoRow label="Addons" className="items-start">
				<InputGroup className="w-72">
					<InputGroupAddon>
						<Search />
					</InputGroupAddon>
					<InputGroupInput value={search} onChange={handleSearchChange} placeholder="Search components" aria-label="Search components" />
					<InputGroupAddon align="inline-end">
						<InputGroupButton size="icon-xs" aria-label="Clear the search" onClick={handleClear}>
							<X />
						</InputGroupButton>
					</InputGroupAddon>
				</InputGroup>
				<InputGroup className="w-72">
					<InputGroupAddon>
						<AtSign />
					</InputGroupAddon>
					<InputGroupInput placeholder="username" aria-label="Username" />
					<InputGroupAddon align="inline-end">
						<InputGroupText>.acme.dev</InputGroupText>
					</InputGroupAddon>
				</InputGroup>
			</DemoRow>
			<DemoRow label="With a textarea">
				<InputGroup className="w-full max-w-md">
					<InputGroupTextarea placeholder="Leave a comment…" aria-label="Comment" />
					<InputGroupAddon align="block-end">
						<InputGroupText>Markdown supported</InputGroupText>
					</InputGroupAddon>
				</InputGroup>
			</DemoRow>
		</DemoSurface>
	);
}

function TextareaDemo(): React.JSX.Element {
	const [bio, setBio] = React.useState<string>("Building the platform's design system.");

	const handleBioChange = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>): void => {
		setBio(readInputValue(event));
	}, []);

	return (
		<DemoSurface>
			<DemoRow label="Controlled, with a counter" className="items-start">
				<div className="flex w-full max-w-md flex-col gap-1.5">
					<Label htmlFor="gallery-textarea-bio">Bio</Label>
					<Textarea id="gallery-textarea-bio" value={bio} onChange={handleBioChange} maxLength={BIO_MAX_LENGTH} aria-describedby="gallery-textarea-bio-count" />
					<p id="gallery-textarea-bio-count" className="text-xs text-muted-foreground tabular-nums">
						{bio.length} / {BIO_MAX_LENGTH}
					</p>
				</div>
			</DemoRow>
			<DemoRow label="Sizes and states" className="items-start">
				<Textarea size="sm" placeholder="Small" aria-label="Small textarea" className="w-56" />
				<Textarea size="lg" placeholder="Large" aria-label="Large textarea" className="w-56" />
				<Textarea disabled placeholder="Disabled" aria-label="Disabled textarea" className="w-56" />
				<Textarea aria-invalid defaultValue="Invalid" aria-label="Invalid textarea" className="w-56" />
			</DemoRow>
		</DemoSurface>
	);
}

function PasswordInputDemo(): React.JSX.Element {
	const [password, setPassword] = React.useState<string>("");
	const [isVisible, setIsVisible] = React.useState<boolean>(false);

	const handlePasswordChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setPassword(readInputValue(event));
	}, []);

	return (
		<DemoSurface>
			<DemoRow label="Controlled visibility" className="items-start">
				<div className="flex w-72 flex-col gap-1.5">
					<Label htmlFor="gallery-password">Password</Label>
					<PasswordInput
						id="gallery-password"
						value={password}
						onChange={handlePasswordChange}
						visible={isVisible}
						onVisibleChange={setIsVisible}
						autoComplete="new-password"
					/>
				</div>
				<PasswordInput disabled placeholder="Disabled" aria-label="Disabled password" className="w-72" />
			</DemoRow>
			<DemoValue label="Visible">{isVisible ? "yes" : "no"}</DemoValue>
		</DemoSurface>
	);
}

function PasswordStrengthMeterDemo(): React.JSX.Element {
	const [password, setPassword] = React.useState<string>("Correct-horse");
	const strength = React.useMemo(() => passwordStrength(password), [password]);

	const handlePasswordChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
		setPassword(readInputValue(event));
	}, []);

	return (
		<DemoSurface>
			<div className="flex w-full max-w-md flex-col gap-3">
				<div className="flex flex-col gap-1.5">
					<Label htmlFor="gallery-strength-password">Try a password</Label>
					<PasswordInput id="gallery-strength-password" value={password} onChange={handlePasswordChange} autoComplete="off" />
				</div>
				<PasswordStrengthMeter score={strength.score} label={strength.label} percent={strength.percent} criteria={strength.criteria} />
			</div>
		</DemoSurface>
	);
}

function InputOtpDemo(): React.JSX.Element {
	const [code, setCode] = React.useState<string>("");

	return (
		<DemoSurface>
			<DemoRow label="Six digits, in two groups">
				<InputOTP maxLength={OTP_LENGTH} pattern={OTP_DIGITS_PATTERN} inputMode="numeric" value={code} onChange={setCode} aria-label="One-time code">
					<InputOTPGroup>
						{OTP_FIRST_HALF.map((slot) => (
							<InputOTPSlot key={slot} index={slot} />
						))}
					</InputOTPGroup>
					<InputOTPSeparator />
					<InputOTPGroup>
						{OTP_SECOND_HALF.map((slot) => (
							<InputOTPSlot key={slot} index={slot} />
						))}
					</InputOTPGroup>
				</InputOTP>
			</DemoRow>
			<DemoRow label="Disabled">
				<InputOTP maxLength={OTP_LENGTH} disabled aria-label="Disabled one-time code">
					<InputOTPGroup>
						{[...OTP_FIRST_HALF, ...OTP_SECOND_HALF].map((slot) => (
							<InputOTPSlot key={slot} index={slot} />
						))}
					</InputOTPGroup>
				</InputOTP>
			</DemoRow>
			<DemoValue label="Code">{code.length > 0 ? code : "(empty)"}</DemoValue>
		</DemoSurface>
	);
}

/** Form inputs: text entry and the field layout around it. Smart: owns every demo's state. */
export function FormInputsFamily(): React.JSX.Element {
	return (
		<>
			<ComponentSection entry={GALLERY_ENTRIES.field} height="h-96">
				<FieldDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.label} height="h-40">
				<LabelDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.input} height="h-56">
				<InputDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.inputGroup} height="h-56">
				<InputGroupDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.textarea} height="h-72">
				<TextareaDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.passwordInput} height="h-40">
				<PasswordInputDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.passwordStrengthMeter} height="h-72">
				<PasswordStrengthMeterDemo />
			</ComponentSection>
			<ComponentSection entry={GALLERY_ENTRIES.inputOtp} height="h-56">
				<InputOtpDemo />
			</ComponentSection>
			<ExampleOnlySections familyId="family-form-inputs" />
		</>
	);
}
