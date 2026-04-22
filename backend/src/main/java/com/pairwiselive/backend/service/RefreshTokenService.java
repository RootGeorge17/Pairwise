package com.pairwiselive.backend.service;

import com.pairwiselive.backend.config.AuthProperties;
import com.pairwiselive.backend.exception.ApiException;
import com.pairwiselive.backend.exception.BadRequestException;
import com.pairwiselive.backend.model.entity.RefreshToken;
import com.pairwiselive.backend.model.entity.User;
import com.pairwiselive.backend.repository.RefreshTokenRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private static final int REFRESH_TOKEN_BYTE_LENGTH = 64;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final RefreshTokenRepository refreshTokenRepository;
    private final AuthProperties authProperties;

    @Transactional
    public String issueRefreshToken(User user) {
        User nonNullUser = Objects.requireNonNull(user, "user must not be null");
        String rawRefreshToken = generateRawToken();

        RefreshToken refreshToken = RefreshToken.builder()
            .user(nonNullUser)
            .tokenHash(hashToken(rawRefreshToken))
            .expiresAt(Instant.now().plusMillis(authProperties.getRefreshTokenExpiryMs()))
            .build();

        refreshTokenRepository.save(refreshToken);
        return rawRefreshToken;
    }

    @Transactional
    public User validateRefreshToken(String rawRefreshToken) {
        RefreshToken refreshToken = refreshTokenRepository.findByTokenHash(hashToken(rawRefreshToken))
            .orElseThrow(this::invalidRefreshToken);

        if (refreshToken.getRevokedAt() != null) {
            throw invalidRefreshToken();
        }

        if (refreshToken.getExpiresAt().isBefore(Instant.now())) {
            refreshToken.setRevokedAt(Instant.now());
            refreshTokenRepository.save(refreshToken);
            throw invalidRefreshToken();
        }

        return refreshToken.getUser();
    }

    @Transactional
    public void revokeRefreshToken(String rawRefreshToken) {
        refreshTokenRepository.findByTokenHash(hashToken(rawRefreshToken))
            .ifPresent(refreshToken -> {
                if (refreshToken.getRevokedAt() == null) {
                    refreshToken.setRevokedAt(Instant.now());
                    refreshTokenRepository.save(refreshToken);
                }
            });
    }

    private String generateRawToken() {
        byte[] randomBytes = new byte[REFRESH_TOKEN_BYTE_LENGTH];
        SECURE_RANDOM.nextBytes(randomBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);
    }

    private String hashToken(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new BadRequestException("refreshToken is required.");
        }

        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(rawRefreshToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 algorithm is not available.", exception);
        }
    }

    private ApiException invalidRefreshToken() {
        return new ApiException(
            HttpStatus.UNAUTHORIZED,
            "INVALID_REFRESH_TOKEN",
            "Invalid or expired refresh token."
        );
    }
}
