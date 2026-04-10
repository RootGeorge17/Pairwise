package com.pairwiselive.backend.model.dto;

public record ChallengeExamplesDTO(
    Long id,
    String input,
    String output,
    String explenationText
) {}
