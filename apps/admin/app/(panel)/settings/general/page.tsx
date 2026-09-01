import GeneralSettingsView from "./general-settings";

/** `/settings/general` — profile + notification preferences. Server wrapper; the form UI lives in `general-settings.tsx`. */
export default function SettingsGeneralPage(): React.JSX.Element {
	return <GeneralSettingsView />;
}
