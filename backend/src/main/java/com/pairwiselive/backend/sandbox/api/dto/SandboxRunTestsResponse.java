package com.pairwiselive.backend.sandbox.api.dto;

import com.pairwiselive.backend.sandbox.domain.SandboxRunStatus;
import java.util.List;

public record SandboxRunTestsResponse(
    String challengeSlug,
    String language,
    SandboxRunStatus status,
    int totalTests,
    int passedTests,
    int failedTests,
    long totalExecutionTimeMs,
    long averageExecutionTimeMs,
    int timeLimitMs,
    int memoryLimitMb,
    List<SandboxTestCaseResult> testResults
) {}
