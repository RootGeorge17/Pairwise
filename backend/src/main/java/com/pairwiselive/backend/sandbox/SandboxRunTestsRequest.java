package com.pairwiselive.backend.sandbox;

public record SandboxRunTestsRequest(
    String slug,
    String language,
    String sourceCode
) {}
