/**
 * Provider tag that carries the email log id. Every send is tagged with it and
 * Resend echoes it on delivery webhooks, so a webhook matches its row even
 * before the send call returned the provider id.
 */
export const EMAIL_LOG_ID_TAG = "email_log_id";
