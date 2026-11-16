import { Command } from "@nestjs/cqrs";
import type { DocsSyncRunAck, DocsSyncRunReport } from "@workspace/shared";

/** One report from the sync. `token` is the bearer token it presented; null when it sent none. */
export class RecordDocsSyncRunCommand extends Command<DocsSyncRunAck> {
	public constructor(
		public readonly token: string | null,
		public readonly report: DocsSyncRunReport,
	) {
		super();
	}
}
