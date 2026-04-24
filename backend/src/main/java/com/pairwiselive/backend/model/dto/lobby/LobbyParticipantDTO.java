package com.pairwiselive.backend.model.dto.lobby;

import java.time.Instant;

public record LobbyParticipantDTO(
    Long userId,
    String username,
    String displayName,
    String pairRole,
    Instant joinedAt
) {}
