package com.pairwiselive.backend.model.dto;

public record ChallengeLanguageDTO(
    Long id,
    String language,
    String starterCode,
    String expectedFunctionName,
    String entryFilename,
    int timeLimitMs,
    int memoryLimitMb,
    boolean isDefault
) {}
