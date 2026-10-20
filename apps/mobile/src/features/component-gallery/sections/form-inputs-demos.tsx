// The Components screen's text and form inputs: the text roles, Icon,
// TextLink, Field, Input, Textarea, InputGroup, PasswordInput,
// PasswordStrengthMeter, InputOTP and TextField. Each example owns its demo
// state here (the kit components stay controlled); nothing is sent to the API
// or stored. The demo's own rules (an email's shape, a password's strength)
// stand in for a form's zod schema: the kit never validates.

import AtSignIcon from "lucide-react-native/icons/at-sign";
import BellIcon from "lucide-react-native/icons/bell";
import HouseIcon from "lucide-react-native/icons/house";
import SearchIcon from "lucide-react-native/icons/search";
import StarIcon from "lucide-react-native/icons/star";
import XIcon from "lucide-react-native/icons/x";
import * as React from "react";
import { Pressable, View } from "react-native";

import { Field } from "@workspace/ui-native/components/field";
import { Icon } from "@workspace/ui-native/components/icon";
import { Input } from "@workspace/ui-native/components/input";
import { InputGroup } from "@workspace/ui-native/components/input-group";
import { InputOTP } from "@workspace/ui-native/components/input-otp";
import { PasswordInput } from "@workspace/ui-native/components/password-input";
import { PasswordStrengthMeter, type PasswordStrengthCriterion } from "@workspace/ui-native/components/password-strength-meter";
import { BodyText, CodeText, ErrorText, Heading, Label, MutedText, Subheading } from "@workspace/ui-native/components/text";
import { TextField } from "@workspace/ui-native/components/text-field";
import { TextLink } from "@workspace/ui-native/components/text-link";
import { Textarea } from "@workspace/ui-native/components/textarea";
import { DemoBlock } from "../demo-block";

/** A sample code for the monospaced role. */
const SAMPLE_BACKUP_CODE = "K7QD-29XM";
/** The OTP demo's code length (a TOTP). */
const OTP_LENGTH = 6;
/** The short OTP demo's length (an email code). */
const SHORT_OTP_LENGTH = 4;
/** The demo's "correct" code, so a wrong one shows the error state. */
const DEMO_OTP_CODE = "123456";
/** How long the demo pretends to check a code or send a link, in ms. */
const DEMO_CHECK_MS = 1200;
/** The demo password rule's minimum length. */
const MIN_PASSWORD_LENGTH = 8;
/** The strength meter's top score (the web kit's 0–4 scale). */
const MAX_STRENGTH_SCORE = 4;
/** The meter's bar is a 0–100 share. */
const PERCENT_SCALE = 100;
/** A comment's longest length in the Textarea demo. */
const MAX_COMMENT_LENGTH = 280;

const STRENGTH_LABELS: Readonly<Record<number, string>> = {
	0: "Too weak",
	1: "Weak",
	2: "Fair",
	3: "Good",
	4: "Strong",
};

const UPPER_CASE_PATTERN = /\p{Lu}/u;
const DIGIT_PATTERN = /\d/u;
const SYMBOL_PATTERN = /[^\p{L}\d\s]/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const NON_DIGIT_PATTERN = /\D/gu;

function digitsOnly(value: string): string {
	return value.replace(NON_DIGIT_PATTERN, "");
}

function upperCase(value: string): string {
	return value.toUpperCase();
}

/** The demo's password criteria — a form would take these from its schema. */
function passwordCriteriaOf(password: string): readonly PasswordStrengthCriterion[] {
	return [
		{ label: `At least ${String(MIN_PASSWORD_LENGTH)} characters`, met: password.length >= MIN_PASSWORD_LENGTH },
		{ label: "An upper-case letter", met: UPPER_CASE_PATTERN.test(password) },
		{ label: "A number", met: DIGIT_PATTERN.test(password) },
		{ label: "A symbol", met: SYMBOL_PATTERN.test(password) },
	];
}

/** Runs `run` after the demo's pretend delay; a newer call replaces a pending one, and unmounting cancels it. */
function useDemoDelay(): (run: () => void) => void {
	const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
	React.useEffect(
		(): (() => void) => (): void => {
			if (timer.current !== null) {
				clearTimeout(timer.current);
			}
		},
		[],
	);
	return React.useCallback((run: () => void): void => {
		if (timer.current !== null) {
			clearTimeout(timer.current);
		}
		timer.current = setTimeout(run, DEMO_CHECK_MS);
	}, []);
}

export function FormInputsDemos(): React.JSX.Element {
	return (
		<View className="gap-4">
			<TextRolesDemo />
			<IconDemo />
			<TextLinkDemo />
			<FieldDemo />
			<InputDemo />
			<TextareaDemo />
			<InputGroupDemo />
			<PasswordInputDemo />
			<PasswordStrengthMeterDemo />
			<InputOTPDemo />
			<TextFieldDemo />
		</View>
	);
}

function TextRolesDemo(): React.JSX.Element {
	return (
		<DemoBlock title="Text" description="The type roles: Heading, Subheading, BodyText, MutedText, Label, ErrorText and CodeText.">
			<Heading>Heading</Heading>
			<Subheading>Subheading</Subheading>
			<BodyText>BodyText — running text that wraps across lines and scales with the system font size.</BodyText>
			<MutedText>MutedText — hints, captions and metadata.</MutedText>
			<Label>Label — a form field&apos;s label</Label>
			<ErrorText>ErrorText — a field or form error</ErrorText>
			<CodeText selectable>{SAMPLE_BACKUP_CODE}</CodeText>
		</DemoBlock>
	);
}

function IconDemo(): React.JSX.Element {
	return (
		<DemoBlock title="Icon" description="A Lucide glyph in five size steps and two weights, coloured by an accent token.">
			<View className="flex-row items-end gap-3">
				<Icon icon={HouseIcon} size="sm" colorClassName="accent-foreground" />
				<Icon icon={HouseIcon} size="md" colorClassName="accent-foreground" />
				<Icon icon={HouseIcon} size="lg" colorClassName="accent-foreground" />
				<Icon icon={HouseIcon} size="xl" colorClassName="accent-foreground" />
				<Icon icon={HouseIcon} size="2xl" colorClassName="accent-foreground" />
			</View>
			<View className="flex-row items-center gap-3">
				<Icon icon={StarIcon} colorClassName="accent-primary" />
				<Icon icon={StarIcon} weight="bold" colorClassName="accent-primary" />
				<Icon icon={BellIcon} colorClassName="accent-muted-foreground" />
				<Icon icon={BellIcon} weight="bold" colorClassName="accent-destructive-foreground" />
			</View>
		</DemoBlock>
	);
}

function TextLinkDemo(): React.JSX.Element {
	const [presses, setPresses] = React.useState(0);
	const [isSending, setSending] = React.useState(false);
	const countPress = React.useCallback((): void => {
		setPresses((count: number): number => count + 1);
	}, []);
	const later = useDemoDelay();
	const resend = React.useCallback((): void => {
		setSending(true);
		later((): void => {
			setSending(false);
		});
	}, [later]);
	return (
		<DemoBlock title="TextLink" description="An inline link with an optional lead-in; a button when it acts in place.">
			<TextLink leadIn="Don't have an account?" label="Create one" onPress={countPress} />
			<TextLink label="Forgot password?" variant="muted" onPress={countPress} />
			<TextLink label="Sign out" role="button" variant="destructive" size="md" onPress={countPress} />
			<TextLink leadIn="Didn't get it?" label="Resend code" loading={isSending} onPress={resend} />
			<TextLink label="Unavailable link" disabled onPress={countPress} />
			<MutedText>{`Links pressed: ${String(presses)}`}</MutedText>
		</DemoBlock>
	);
}

function FieldDemo(): React.JSX.Element {
	const [email, setEmail] = React.useState("alex@");
	const emailError = email.length > 0 && !EMAIL_PATTERN.test(email) ? "Enter a valid email address" : undefined;
	return (
		<DemoBlock title="Field" description="A label, the control, a hint and the error message; names the control inside it.">
			<Field label="Work email" hint="We send receipts here" error={emailError}>
				<Input value={email} onChange={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
			</Field>
			<Field label="Tenant" hint="Managed by your administrator" disabled>
				<Input value="Acme Sdn Bhd" onChange={setEmail} />
			</Field>
		</DemoBlock>
	);
}

function InputDemo(): React.JSX.Element {
	const [name, setName] = React.useState("");
	const [username, setUsername] = React.useState("alex");
	return (
		<DemoBlock title="Input" description="A single-line text input: sizes and the default, loading, disabled and error states.">
			<Input accessibilityLabel="Small input" placeholder="Small" size="sm" value={name} onChange={setName} />
			<Input accessibilityLabel="Name" placeholder="Medium (default)" value={name} onChange={setName} />
			<Input accessibilityLabel="Large input" placeholder="Large" size="lg" value={name} onChange={setName} />
			<Input accessibilityLabel="Username, checking" value={username} onChange={setUsername} loading />
			<Input accessibilityLabel="Disabled input" value="Read only" onChange={setName} disabled />
			<Input accessibilityLabel="Invalid input" value="not-an-email" onChange={setName} invalid />
		</DemoBlock>
	);
}

function TextareaDemo(): React.JSX.Element {
	const [comment, setComment] = React.useState("");
	return (
		<DemoBlock title="Textarea" description="A multi-line input that grows with its text, in three starting heights.">
			<Field label="Comment" hint={`${String(comment.length)} / ${String(MAX_COMMENT_LENGTH)}`}>
				<Textarea value={comment} onChange={setComment} placeholder="Leave a comment" maxLength={MAX_COMMENT_LENGTH} autoCapitalize="sentences" />
			</Field>
			<Textarea accessibilityLabel="Short note" size="sm" value={comment} onChange={setComment} placeholder="Small" />
			<Textarea accessibilityLabel="Disabled note" value="Comments are closed." onChange={setComment} disabled />
		</DemoBlock>
	);
}

function InputGroupDemo(): React.JSX.Element {
	const [query, setQuery] = React.useState("");
	const [website, setWebsite] = React.useState("");
	const [amount, setAmount] = React.useState("42.00");
	const [handle, setHandle] = React.useState("");
	const clearQuery = React.useCallback((): void => {
		setQuery("");
	}, []);
	const clearButton = React.useMemo(
		(): React.ReactNode =>
			query.length === 0 ? undefined : (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel="Clear search"
					onPress={clearQuery}
					hitSlop={8}
					className="size-7 items-center justify-center rounded-full active:opacity-60">
					<Icon icon={XIcon} size="sm" colorClassName="accent-muted-foreground" />
				</Pressable>
			),
		[clearQuery, query.length],
	);
	return (
		<DemoBlock title="InputGroup" description="An input with a glyph or short text before or after it, or any trailing element.">
			<InputGroup
				accessibilityLabel="Search"
				placeholder="Search orders"
				leadingIcon={SearchIcon}
				value={query}
				onChange={setQuery}
				trailing={clearButton}
				returnKeyType="search"
			/>
			<InputGroup
				accessibilityLabel="Website"
				leadingText="https://"
				placeholder="example.com"
				value={website}
				onChange={setWebsite}
				autoCapitalize="none"
				keyboardType="url"
			/>
			<InputGroup accessibilityLabel="Amount" leadingText="RM" trailingText="MYR" value={amount} onChange={setAmount} keyboardType="decimal-pad" size="lg" />
			<InputGroup accessibilityLabel="Handle" leadingIcon={AtSignIcon} value={handle} onChange={setHandle} size="sm" invalid placeholder="Taken handle" />
		</DemoBlock>
	);
}

function PasswordInputDemo(): React.JSX.Element {
	const [password, setPassword] = React.useState("correct horse");
	return (
		<DemoBlock title="PasswordInput" description="A masked input with an eye button that shows or hides what was typed.">
			<Field label="Password">
				<PasswordInput value={password} onChange={setPassword} autoCapitalize="none" autoComplete="current-password" textContentType="password" />
			</Field>
			<PasswordInput
				accessibilityLabel="Disabled password"
				showLabel="Show disabled password"
				hideLabel="Hide disabled password"
				value="secret"
				onChange={setPassword}
				disabled
			/>
			<PasswordInput
				accessibilityLabel="Invalid password"
				showLabel="Show invalid password"
				hideLabel="Hide invalid password"
				value="short"
				onChange={setPassword}
				invalid
				size="sm"
			/>
		</DemoBlock>
	);
}

function PasswordStrengthMeterDemo(): React.JSX.Element {
	const [password, setPassword] = React.useState("Hunter2");
	const criteria = React.useMemo(() => passwordCriteriaOf(password), [password]);
	const score = password.length === 0 ? 0 : criteria.filter((criterion: PasswordStrengthCriterion): boolean => criterion.met).length;
	const label = STRENGTH_LABELS[score] ?? "";
	return (
		<DemoBlock title="PasswordStrengthMeter" description="A bar, a badge and a checklist for a strength the screen computes.">
			<Field label="New password">
				<PasswordInput value={password} onChange={setPassword} autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
			</Field>
			<PasswordStrengthMeter score={score} label={label} percent={(score / MAX_STRENGTH_SCORE) * PERCENT_SCALE} criteria={criteria} />
			<MutedText>Clear the password to hide the meter.</MutedText>
		</DemoBlock>
	);
}

function InputOTPDemo(): React.JSX.Element {
	const [code, setCode] = React.useState("");
	const [isChecking, setChecking] = React.useState(false);
	const [checkedCode, setCheckedCode] = React.useState<string | null>(null);
	const [shortCode, setShortCode] = React.useState("42");
	const changeCode = React.useCallback((next: string): void => {
		setCode(next);
		setCheckedCode(null);
	}, []);
	const later = useDemoDelay();
	const checkCode = React.useCallback(
		(complete: string): void => {
			setChecking(true);
			later((): void => {
				setChecking(false);
				setCheckedCode(complete);
			});
		},
		[later],
	);
	const error = checkedCode !== null && checkedCode !== DEMO_OTP_CODE ? "That code is not right — try 123456" : undefined;
	return (
		<DemoBlock title="InputOTP" description="One cell per digit over one hidden input; reports completion so the screen can check it.">
			<Field label="Authentication code" hint="From your authenticator app" error={error} loading={isChecking}>
				<InputOTP value={code} onChange={changeCode} onComplete={checkCode} length={OTP_LENGTH} normalize={digitsOnly} />
			</Field>
			{checkedCode === DEMO_OTP_CODE ? <MutedText>Code accepted.</MutedText> : null}
			<InputOTP accessibilityLabel="Email code" value={shortCode} onChange={setShortCode} length={SHORT_OTP_LENGTH} size="sm" normalize={digitsOnly} />
			<InputOTP accessibilityLabel="Disabled code" value="1234" onChange={setShortCode} length={SHORT_OTP_LENGTH} size="lg" disabled />
		</DemoBlock>
	);
}

function TextFieldDemo(): React.JSX.Element {
	const [fullName, setFullName] = React.useState("");
	const [backupCode, setBackupCode] = React.useState("");
	const [token, setToken] = React.useState("");
	return (
		<DemoBlock title="TextField" description="Field + Input in one: a label, hint, error, password eye and input shaping.">
			<TextField
				label="Full name"
				value={fullName}
				onChange={setFullName}
				autoComplete="name"
				textContentType="name"
				error={fullName.length === 1 ? "Enter your full name" : undefined}
			/>
			<TextField label="Backup code" value={backupCode} onChange={setBackupCode} normalize={upperCase} autoCapitalize="characters" hint="Letters and digits, as printed" />
			<TextField label="Access token" value={token} onChange={setToken} secureTextEntry autoCapitalize="none" placeholder="Paste your token" />
			<TextField label="Account ID" value="acct_8842" onChange={setToken} disabled />
		</DemoBlock>
	);
}
