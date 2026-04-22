package com.pairwiselive.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Validated
@ConfigurationProperties(prefix = "pairwise.auth.jwt")
@Getter
@Setter
public class AuthProperties {

    @NotBlank(message = "pairwise.auth.jwt.secret is required.")
    private String secret = "";

    @Min(value = 1, message = "pairwise.auth.jwt.access-token-expiry-ms must be >= 1.")
    private long accessTokenExpiryMs = 1800000L;

    @Min(value = 1, message = "pairwise.auth.jwt.refresh-token-expiry-ms must be >= 1.")
    private long refreshTokenExpiryMs = 1209600000L;
}
