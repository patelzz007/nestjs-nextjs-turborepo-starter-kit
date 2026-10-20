/** Names the user the current tracked auth flow (`@TrackAuthFlow`) acts on, as soon as the use case knows it. */
export interface AuthFlowSubjectPort {
	identify(userId: string): void;
}
