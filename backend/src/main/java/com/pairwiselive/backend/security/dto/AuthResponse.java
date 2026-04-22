package com.pairwiselive.backend.security.dto;

public record AuthResponse(
    String accessToken,
    String refreshToken,
    Long userId,
    String username,
    String email,
    String displayName,
    String role
) {}
