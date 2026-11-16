import BuildingIcon from "lucide-react-native/icons/building";
import KeyRoundIcon from "lucide-react-native/icons/key-round";
import MailIcon from "lucide-react-native/icons/mail";
import ShareIcon from "lucide-react-native/icons/share";
import SmartphoneIcon from "lucide-react-native/icons/smartphone";
import UsersIcon from "lucide-react-native/icons/users";

import type { LucideIcon } from "@workspace/ui-native/components/icon";

// Sample sign-in / sharing methods for the social-style Button examples (the
// web showcase's set): the reui originals use third-party brand logos; the
// kit shows neutral lucide glyphs instead, coloured only through design tokens.

export interface SignInMethod {
	readonly id: string;
	readonly label: string;
	readonly icon: LucideIcon;
	/** The glyph's accent: a categorical tone token, as an icon colour class. */
	readonly toneClassName: string;
}

export const SIGN_IN_METHODS: readonly SignInMethod[] = [
	{ id: "email", label: "Email", icon: MailIcon, toneClassName: "accent-tone-red" },
	{ id: "passkey", label: "Passkey", icon: KeyRoundIcon, toneClassName: "accent-tone-blue" },
	{ id: "phone", label: "Phone", icon: SmartphoneIcon, toneClassName: "accent-tone-green" },
	{ id: "sso", label: "Single sign-on", icon: BuildingIcon, toneClassName: "accent-tone-violet" },
];

/** Generic share / connect targets for the icon-only row. */
export const SHARE_TARGETS: readonly SignInMethod[] = [
	...SIGN_IN_METHODS,
	{ id: "team", label: "Team", icon: UsersIcon, toneClassName: "accent-tone-teal" },
	{ id: "share", label: "Share", icon: ShareIcon, toneClassName: "accent-tone-orange" },
];
