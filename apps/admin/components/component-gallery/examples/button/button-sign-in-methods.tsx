import { BuildingIcon, KeyRoundIcon, MailIcon, ShareIcon, SmartphoneIcon, UsersIcon, type LucideIcon } from "lucide-react";

// Sample sign-in / sharing methods for the social-style Button examples. The
// reui originals use third-party brand logos; the kit shows neutral lucide
// glyphs instead, coloured only through design tokens.

export interface SignInMethod {
	readonly id: string;
	readonly label: string;
	readonly icon: LucideIcon;
	/** The glyph's accent: a categorical tone token, as a text colour class. */
	readonly toneClassName: string;
}

export const SIGN_IN_METHODS: readonly SignInMethod[] = [
	{ id: "email", label: "Email", icon: MailIcon, toneClassName: "text-tone-red" },
	{ id: "passkey", label: "Passkey", icon: KeyRoundIcon, toneClassName: "text-tone-blue" },
	{ id: "phone", label: "Phone", icon: SmartphoneIcon, toneClassName: "text-tone-green" },
	{ id: "sso", label: "Single sign-on", icon: BuildingIcon, toneClassName: "text-tone-violet" },
];

/** Generic share / connect targets for the icon-only row. */
export const SHARE_TARGETS: readonly SignInMethod[] = [
	...SIGN_IN_METHODS,
	{ id: "team", label: "Team", icon: UsersIcon, toneClassName: "text-tone-teal" },
	{ id: "share", label: "Share", icon: ShareIcon, toneClassName: "text-tone-orange" },
];
