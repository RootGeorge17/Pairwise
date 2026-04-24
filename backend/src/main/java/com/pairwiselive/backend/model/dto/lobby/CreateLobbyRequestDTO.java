package com.pairwiselive.backend.model.dto.lobby;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record CreateLobbyRequestDTO(
    @NotNull Long challengeId,
    @NotNull Long challengeLanguageId,
    String name,
    Boolean roleRotationEnabled,
    @Min(1) Integer rotationIntervalSecs
) {}
