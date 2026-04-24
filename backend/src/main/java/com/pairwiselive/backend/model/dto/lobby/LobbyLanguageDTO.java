package com.pairwiselive.backend.model.dto.lobby;

public record LobbyLanguageDTO(
    Long id,
    String language,
    String starterCode,
    String entryFilename,
    int timeLimitMs,
    int memoryLimitMb,
    boolean isDefault
) {}
