import type { IdGenerator } from "../../application/ports/rewards.tokens";
import { newRowId } from "@workspace/shared";

/** Random v4 UUIDs for new rows. */
export class UuidIdGenerator implements IdGenerator {
	public next(): string {
		return newRowId();
	}
}
