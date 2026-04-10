package com.pairwiselive.backend.sandbox;

public record SandboxExecutionRequest(
    String sourceCode,
    String entryFilename,
    String expectedFunctionName,
    String dockerImage,
    int timeLimitMs,
    int memoryLimitMb,
    String inputJson
) {}
