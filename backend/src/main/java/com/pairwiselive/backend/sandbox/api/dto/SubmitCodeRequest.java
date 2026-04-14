package com.pairwiselive.backend.sandbox.api.dto;

import jakarta.validation.constraints.NotBlank;

public record SubmitCodeRequest(
    @NotBlank(message = "slug is required.")
    String slug,
    @NotBlank(message = "language is required.")
    String language,
    @NotBlank(message = "sourceCode is required.")
    String sourceCode
) {}
