import { NewStatusIncidentForm } from "@/contexts/operations/components/status-page/new-status-incident-form";

export const dynamic = "force-dynamic";

/** `/operations/status/new` — open an incident on the public status page. */
export default function NewStatusIncidentPage(): React.JSX.Element {
	return <NewStatusIncidentForm />;
}
