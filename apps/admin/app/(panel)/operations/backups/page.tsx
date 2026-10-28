import { BackupsView } from "@/contexts/operations/components/backups-view";

export const dynamic = "force-dynamic";

/** `/operations/backups` — SuperAdmin: database backups, their schedule and downloads (ADR 068). */
export default function OperationsBackupsPage(): React.JSX.Element {
	return <BackupsView />;
}
