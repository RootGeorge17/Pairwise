package com.pairwiselive.backend.model.dto.lobby;

import jakarta.validation.constraints.NotNull;

public record TransferLobbyHostRequestDTO(
    @NotNull Long hostUserId
) {}
