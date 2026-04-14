package com.pairwiselive.backend.sandbox.api.dto;

import java.util.List;

public record SandboxRunTestsResponse(
    String challengeSlug,
    String language,
    String status,
    int totalTests,
    int passedTests,
    int failedTests,
    long totalExecutionTimeMs,
    long averageExecutionTimeMs,
    int timeLimitMs,
    int memoryLimitMb,
    List<SandboxTestCaseResult> testResults
) {}
