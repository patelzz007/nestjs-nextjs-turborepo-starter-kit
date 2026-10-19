import { Injectable } from "@nestjs/common";

import type { IdGeneratorPort } from "../../application/ports/id-generator.port";
import { newRowId } from "@workspace/shared";

@Injectable()
export class UuidIdGenerator implements IdGeneratorPort {
	public next(): string {
		return newRowId();
	}
}
