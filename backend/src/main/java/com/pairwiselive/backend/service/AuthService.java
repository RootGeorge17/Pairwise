package com.pairwiselive.backend.service;


import com.pairwiselive.backend.exception.ApiException;
import com.pairwiselive.backend.model.entity.User;
import com.pairwiselive.backend.model.enums.Provider;
import com.pairwiselive.backend.model.enums.Role;
import com.pairwiselive.backend.repository.UserRepository;
import com.pairwiselive.backend.security.CustomUserDetails;
import com.pairwiselive.backend.security.JwtService;
import com.pairwiselive.backend.security.dto.AuthResponse;
import com.pairwiselive.backend.security.dto.LoginRequest;
import com.pairwiselive.backend.security.dto.MeResponse;
import com.pairwiselive.backend.security.dto.RefreshTokenRequest;
import com.pairwiselive.backend.security.dto.RegisterRequest;

import java.time.Instant;
import java.util.Locale;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final AuthenticationManager authenticationManager;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String normalizedEmail = normalizeEmail(request.email());
        String normalizedUsername = normalizeField(request.username());
        String normalizedDisplayName = normalizeField(request.displayName());

        if (userRepository.existsByEmail(normalizedEmail) || userRepository.existsByUsername(normalizedUsername)) {
            throw new ApiException(
                HttpStatus.CONFLICT,
                "USER_ALREADY_EXISTS",
                "Email or username already in use."
            );
        }

        User user = User.builder()
            .username(normalizedUsername)
            .email(normalizedEmail)
            .displayName(normalizedDisplayName)
            .passwordHash(passwordEncoder.encode(request.password()))
            .provider(Provider.LOCAL)
            .role(Role.ROLE_USER) // Default role
            .lastLoginAt(Instant.now())
            .build();

        try {
            userRepository.save(user);
        } catch (DataIntegrityViolationException exception) {
            throw new ApiException(
                HttpStatus.CONFLICT,
                "USER_ALREADY_EXISTS",
                "Email or username already in use."
            );
        }
        
        CustomUserDetails userDetails = new CustomUserDetails(Objects.requireNonNull(user));
        String accessToken = jwtService.generateToken(userDetails);
        String refreshToken = refreshTokenService.issueRefreshToken(user);

        return new AuthResponse(
            accessToken,
            refreshToken,
            user.getId(),
            user.getUsername(),
            user.getEmail(),
            user.getDisplayName(),
            user.getRole().name()
        );
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String normalizedEmail = normalizeEmail(request.email());

        try {
            authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(normalizedEmail, request.password())
            );
        } catch (AuthenticationException exception) {
            throw new ApiException(
                HttpStatus.UNAUTHORIZED,
                "INVALID_CREDENTIALS",
                "Invalid email or password."
            );
        }

        User user = userRepository.findByEmail(normalizedEmail)
            .orElseThrow(this::unauthorizedUserNotFound);
        user.setLastLoginAt(Instant.now());
        userRepository.save(user);

        CustomUserDetails userDetails = new CustomUserDetails(Objects.requireNonNull(user));
        String accessToken = jwtService.generateToken(userDetails);
        String refreshToken = refreshTokenService.issueRefreshToken(user);

        return new AuthResponse(
            accessToken,
            refreshToken,
            user.getId(),
            user.getUsername(),
            user.getEmail(),
            user.getDisplayName(),
            user.getRole().name()
        );
    }

    @Transactional
    public AuthResponse refresh(RefreshTokenRequest request) {
        String rawRefreshToken = request.refreshToken();
        User tokenUser = refreshTokenService.validateRefreshToken(rawRefreshToken);
        refreshTokenService.revokeRefreshToken(rawRefreshToken);

        User user = userRepository.findById(tokenUser.getId())
            .orElseThrow(this::unauthorizedUserNotFound);

        CustomUserDetails userDetails = new CustomUserDetails(Objects.requireNonNull(user));
        String accessToken = jwtService.generateToken(userDetails);
        String refreshToken = refreshTokenService.issueRefreshToken(user);

        return new AuthResponse(
            accessToken,
            refreshToken,
            user.getId(),
            user.getUsername(),
            user.getEmail(),
            user.getDisplayName(),
            user.getRole().name()
        );
    }

    @Transactional
    public void logout(RefreshTokenRequest request) {
        refreshTokenService.revokeRefreshToken(request.refreshToken());
    }

    @Transactional(readOnly = true)
    public MeResponse getCurrentUser(CustomUserDetails principal) {
        if (principal == null) {
            throw new ApiException(
                HttpStatus.UNAUTHORIZED,
                "UNAUTHENTICATED",
                "Authentication is required."
            );
        }

        CustomUserDetails userDetails = principal;
        User user = userDetails.getUser();

        return new MeResponse(
            user.getId(),
            user.getUsername(),
            user.getEmail(),
            user.getDisplayName(),
            user.getRole().name()
        );
    }

    private ApiException unauthorizedUserNotFound() {
        return new ApiException(
            HttpStatus.UNAUTHORIZED,
            "USER_NOT_FOUND",
            "Authenticated user no longer exists."
        );
    }

    private String normalizeEmail(String email) {
        return normalizeField(email).toLowerCase(Locale.ROOT);
    }

    private String normalizeField(String value) {
        return Objects.requireNonNull(value, "value must not be null").trim();
    }
}
