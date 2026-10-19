import { Query } from "@nestjs/cqrs";
import type { DataChangeLogDetail, DataChangeLogIdParam } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** One complete row-change record with its row images (`GET /admin/data-changes/:id`). */
export class GetDataChangeQuery extends Query<DataChangeLogDetail> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: DataChangeLogIdParam,
	) {
		super();
	}
}
