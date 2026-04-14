export type SandboxRunTestsRequest = {
    slug: string;
    language: string;
    sourceCode: string;
};

export type SandboxTestCaseResult = {
    testNumber: number;
    passed: boolean;
    status: string;
    input: string;
    expectedOutput: string;
    actualOutput: string;
    stdout: string;
    stderr: string;
    exitCode: number | null;
    executionTimeMs: number | null;
    memoryUsedMb: number | null;
};

export type SandboxRunTestsResponse = {
    challengeSlug: string;
    language: string;
    status: string;
    totalTests: number;
    passedTests: number;
    failedTests: number;
    totalExecutionTimeMs: number;
    averageExecutionTimeMs: number;
    peakMemoryUsedMb: number | null;
    timeLimitMs: number;
    memoryLimitMb: number;
    testResults: SandboxTestCaseResult[];
};
