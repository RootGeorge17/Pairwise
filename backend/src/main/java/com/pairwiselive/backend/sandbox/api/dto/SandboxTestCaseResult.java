package com.pairwiselive.backend.sandbox.api.dto;

public record SandboxTestCaseResult(
    int testNumber,
    boolean passed,
    String status,
    String input,
    String expectedOutput,
    String actualOutput,
    String stdout,
    String stderr,
    Integer exitCode,
    Long executionTimeMs
) {}
