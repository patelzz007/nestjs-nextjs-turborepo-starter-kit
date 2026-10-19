/** A freshly minted invitation token: the raw value leaves the API only inside the invite email. */
export interface IssuedInviteToken {
	readonly rawToken: string;
	readonly tokenHash: string;
}

/** Invitation tokens are random bearer secrets; only their hash is stored. */
export interface InviteTokenPort {
	issue(): IssuedInviteToken;
	hash(rawToken: string): string;
}
