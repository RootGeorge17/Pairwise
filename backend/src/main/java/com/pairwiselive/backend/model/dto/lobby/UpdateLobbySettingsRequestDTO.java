package com.pairwiselive.backend.model.dto.lobby;

import jakarta.validation.constraints.Min;

public record UpdateLobbySettingsRequestDTO(
    Boolean roleRotationEnabled,
    @Min(1) Integer rotationIntervalSecs
) {}
