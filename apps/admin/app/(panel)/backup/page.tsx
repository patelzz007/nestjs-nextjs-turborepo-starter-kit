import { createServerCaller } from "@workspace/client/lib/api/server-api";

import BackupPanel from "./backup-panel";

export const dynamic = "force-dynamic";

/** `/backup` — fetches the backup history + options server-side; polling stays client-side. */
export default async function BackupPage(): Promise<React.JSX.Element> {
	const server = createServerCaller();
	const [listData, optionsData] = await Promise.all([server.backup.list.query(undefined), server.backup.options.query(undefined)]);

	return <BackupPanel initialList={listData} initialOptions={optionsData} />;
}
