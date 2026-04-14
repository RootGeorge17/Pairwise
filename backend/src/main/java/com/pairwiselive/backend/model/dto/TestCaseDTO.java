package com.pairwiselive.backend.model.dto;

public record TestCaseDTO(
    Long id,
    String input,
    String output,
    boolean isHidden
) {}
