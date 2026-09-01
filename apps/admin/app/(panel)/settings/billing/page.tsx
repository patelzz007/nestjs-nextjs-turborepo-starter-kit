import BillingSettingsView from "./billing-settings";

/** `/settings/billing` — plan, payment method, and invoices. Server wrapper; the UI lives in `billing-settings.tsx`. */
export default function SettingsBillingPage(): React.JSX.Element {
	return <BillingSettingsView />;
}
