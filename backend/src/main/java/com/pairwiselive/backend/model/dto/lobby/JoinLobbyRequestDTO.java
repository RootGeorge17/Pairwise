package com.pairwiselive.backend.model.dto.lobby;

import jakarta.validation.constraints.NotBlank;

public record JoinLobbyRequestDTO(
    @NotBlank String joinCode
) {}
