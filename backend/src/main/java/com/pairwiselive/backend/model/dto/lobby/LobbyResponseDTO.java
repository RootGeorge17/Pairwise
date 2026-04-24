package com.pairwiselive.backend.model.dto.lobby;

import java.time.Instant;
import java.util.List;

public record LobbyResponseDTO(
    Long id,
    String joinCode,
    String name,
    String status,
    Long hostUserId,
    Long currentDriverUserId,
    short maxParticipants,
    boolean roleRotationEnabled,
    Integer rotationIntervalSecs,
    Instant lastRoleSwitchAt,
    Instant createdAt,
    Instant startedAt,
    Instant endedAt,
    LobbyChallengeDTO challenge,
    LobbyLanguageDTO language,
    List<LobbyParticipantDTO> participants,
    String currentUserRole
) {}
