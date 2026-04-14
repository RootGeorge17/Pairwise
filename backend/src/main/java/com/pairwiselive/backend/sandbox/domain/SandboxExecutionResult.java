package com.pairwiselive.backend.sandbox.domain;

public record SandboxExecutionResult(
    boolean success,
    boolean timedOut,
    SandboxExecutionStatus status,
    String stdout,
    String stderr,
    Integer exitCode,
    Long executionTimeMs,
    boolean stdoutTruncated,
    boolean stderrTruncated
) {}
