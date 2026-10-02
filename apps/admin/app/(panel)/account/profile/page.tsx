import ProfileSettingsView from "./profile-settings";

/** `/account/profile` — the signed-in admin's profile + notification preferences. Server wrapper; the form UI lives in `profile-settings.tsx`. */
export default function AccountProfilePage(): React.JSX.Element {
	return <ProfileSettingsView />;
}
