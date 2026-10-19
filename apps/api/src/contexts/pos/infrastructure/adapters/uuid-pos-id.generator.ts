import { Injectable } from "@nestjs/common";

import type { PosIdGenerator } from "../../application/ports/pos.tokens";
import { newRowId } from "@workspace/shared";

/** Sale ids (UUID v7 row ids), chosen before insert so the outbox event can name the sale. */
@Injectable()
export class UuidPosIdGenerator implements PosIdGenerator {
	public next(): string {
		return newRowId();
	}
}
