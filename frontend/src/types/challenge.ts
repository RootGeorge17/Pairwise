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
    explenationText: string | null;
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
