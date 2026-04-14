package com.pairwiselive.backend.sandbox.api.dto;

import com.pairwiselive.backend.model.enums.SubmissionStatus;
import java.util.List;

public record SubmitCodeResponse(
    Long submissionId,
    String challengeSlug,
    String language,
    SubmissionStatus status,
    int totalTests,
    int passedTests,
    int failedTests,
    int score,
    long totalExecutionTimeMs,
    Integer peakMemoryUsedMb,
    boolean solved,
    int bestScore,
    List<SubmitTestCaseResult> testResults
) {}
