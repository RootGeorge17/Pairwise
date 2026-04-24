package com.pairwiselive.backend.model.dto.lobby;

public record LobbyChallengeDTO(
    Long id,
    String slug,
    String title,
    String difficulty
) {}
