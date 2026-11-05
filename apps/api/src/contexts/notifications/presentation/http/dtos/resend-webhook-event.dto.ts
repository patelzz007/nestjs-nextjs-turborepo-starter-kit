import { ResendWebhookEventSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";

/**
 * Documented body for `POST /notifications/email-webhook` (Swagger only).
 *
 * The endpoint does NOT validate this shape via a pipe: the shared inbound
 * receiver (ADR 081) verifies the Standard Webhooks signature over the raw body
 * first (the signature is the gate), and only then is the body parsed. This DTO exists so Swagger's "Try it out" shows a
 * body editor + example instead of nothing.
 */
export class ResendWebhookEventDto extends createZodDto(ResendWebhookEventSchema) {}
