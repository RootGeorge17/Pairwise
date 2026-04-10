package com.pairwiselive.backend.sandbox;

public record SandboxExecutionResult(
    boolean success,
    boolean timedOut,
    String status,
    String stdout,
    String stderr,
    Integer exitCode,
    Long executionTimeMs
) {}