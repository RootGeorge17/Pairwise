package com.pairwiselive.backend.model.dto;

public record ChallengeSummaryDTO(
    Long id,
    String slug,
    String title,
    String difficulty
) {}
