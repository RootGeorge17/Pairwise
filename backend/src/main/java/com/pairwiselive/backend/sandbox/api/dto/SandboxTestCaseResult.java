package com.pairwiselive.backend.sandbox.api.dto;

import com.pairwiselive.backend.sandbox.domain.SandboxTestStatus;

public record SandboxTestCaseResult(
    int testNumber,
    boolean passed,
    SandboxTestStatus status,
    String input,
    String expectedOutput,
    String actualOutput,
    String stdout,
    String stderr,
    Integer exitCode,
    Long executionTimeMs,
    boolean stdoutTruncated,
    boolean stderrTruncated
) {}
