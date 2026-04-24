export type ChallengeSummary = {
    id: number;
    slug: string;
    title: string;
    difficulty: string;
};

export type ChallengeExample = {
    id: number;
    input: string;
    output: string;
    explanationText: string | null;
};

export type ChallengeLanguage = {
    id: number;
    language: string;
    starterCode: string;
    expectedFunctionName: string;
    entryFilename: string;
    timeLimitMs: number;
    memoryLimitMb: number;
    isDefault: boolean;
};

export type ChallengeDetails = {
    id: number;
    title: string;
    slug: string;
    description: string;
    difficulty: string;
    constraintsText: string | null;
    followUpText: string | null;
    languages: ChallengeLanguage[];
    examples: ChallengeExample[];
};

export type LobbyChallenge = {
    id: number;
    slug: string;
    title: string;
    difficulty: string;
};

export type LobbyLanguage = {
    id: number;
    language: string;
    starterCode: string;
    entryFilename: string;
    timeLimitMs: number;
    memoryLimitMb: number;
    isDefault: boolean;
};

export type LobbyParticipant = {
    userId: number;
    username: string;
    displayName: string;
    pairRole: string;
    joinedAt: string;
};

export type LobbyResponse = {
    id: number;
    joinCode: string;
    name: string | null;
    status: string;
    hostUserId: number;
    currentDriverUserId: number | null;
    maxParticipants: number;
    roleRotationEnabled: boolean;
    rotationIntervalSecs: number | null;
    lastRoleSwitchAt: string | null;
    createdAt: string;
    startedAt: string | null;
    endedAt: string | null;
    challenge: LobbyChallenge;
    language: LobbyLanguage;
    participants: LobbyParticipant[];
    currentUserRole: string | null;
};

export type CreateLobbyRequest = {
    challengeId: number;
    challengeLanguageId: number;
    name?: string;
    roleRotationEnabled?: boolean;
    rotationIntervalSecs?: number;
};

export type JoinLobbyRequest = {
    joinCode: string;
};

export type UpdateLobbySettingsRequest = {
    roleRotationEnabled?: boolean;
    rotationIntervalSecs?: number;
};
