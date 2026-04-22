package com.pairwiselive.backend.security.dto;

public record MeResponse(
    Long userId,
    String username,
    String email,
    String displayName,
    String role
) {}