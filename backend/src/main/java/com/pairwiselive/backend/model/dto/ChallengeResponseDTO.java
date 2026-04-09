package com.pairwiselive.backend.model.dto;

import java.util.List;

public record ChallengeResponseDTO(
    Long id,
    String title,
    String slug,
    String description,
    String difficulty,
    String constraintsText,
    String followUpText,
    List<ChallengeLanguageDTO> languages,
    List<TestCaseDTO> examples
) {}
