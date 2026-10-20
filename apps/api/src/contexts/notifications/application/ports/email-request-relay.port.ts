/** Hands one committed `notification.email.requested` outbox row to the email queue right now. */
export interface EmailRequestRelayPort {
	relayNow(outboxEventId: string): Promise<void>;
}
