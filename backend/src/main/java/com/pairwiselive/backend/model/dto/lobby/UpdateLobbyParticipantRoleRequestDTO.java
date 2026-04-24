package com.pairwiselive.backend.model.dto.lobby;

import com.pairwiselive.backend.model.enums.PairRole;
import jakarta.validation.constraints.NotNull;

public record UpdateLobbyParticipantRoleRequestDTO(
    @NotNull PairRole pairRole
) {}
