import { ResendWebhookEventSchema } from "@workspace/shared";
import { createZodDto } from "nestjs-zod";

/**
 * Documented body for `POST /notifications/email-webhook` (Swagger only).
 *
 * The endpoint does NOT validate this shape via a pipe — it verifies the
 * payload with `resend.webhooks.verify()` over the raw body (signature is the
 * gate, not the schema). This DTO exists so Swagger's "Try it out" shows a
 * body editor + example instead of nothing.
 */
export class ResendWebhookEventDto extends createZodDto(ResendWebhookEventSchema) {}
