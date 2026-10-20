import type { IQuery } from "@nestjs/cqrs";

/** A query bus that keeps what was dispatched and answers nothing — the controller's one call is what is checked. */
export class RecordingQueryBus {
	public readonly executed: IQuery[] = [];

	public execute(query: IQuery): Promise<null> {
		this.executed.push(query);
		return Promise.resolve(null);
	}
}
