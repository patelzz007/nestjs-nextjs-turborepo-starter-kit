// ============================================
// http-webhook-failure.reader.ts - What status a thrown error is answered with (ADR 081)
// ============================================
// The received-webhook log records the HTTP status the provider really got. The global exception filter
// maps a DomainError through the domain status map and everything else through `mapException`; this reads
// an error the same two ways, so the row and the response cannot disagree.

import { Injectable } from "@nestjs/common";
import { RECEIVED_WEBHOOK_ERROR_SUMMARY_MAX_LENGTH, type CaughtValue } from "@workspace/shared";

import { DomainError } from "../../../../../platform/domain/errors/domain-error";
import { mapException } from "../../../../../platform/infrastructure/errors/exception-mapper";
import { mapDomainError } from "../../../../../platform/presentation/http/errors/map-domain-error";
import type { WebhookFailure, WebhookFailureReaderPort } from "../../application/ports/webhook-failure-reader.port";

/** Never echo an unexpected error's own message: only what a client would see. */
const MAPPING_OPTIONS = { exposeInternalErrors: false };

@Injectable()
export class HttpWebhookFailureReader implements WebhookFailureReaderPort {
	public read(error: CaughtValue): WebhookFailure {
		const mapped = error instanceof DomainError ? mapDomainError(error, MAPPING_OPTIONS) : mapException(error, MAPPING_OPTIONS);
		return { httpStatus: mapped.httpStatus, summary: `${mapped.code}: ${mapped.message}`.slice(0, RECEIVED_WEBHOOK_ERROR_SUMMARY_MAX_LENGTH) };
	}
}
