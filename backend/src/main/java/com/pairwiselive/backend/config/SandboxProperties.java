package com.pairwiselive.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Validated
@ConfigurationProperties(prefix = "pairwise.sandbox")
@Getter
@Setter
public class SandboxProperties {

    @NotBlank(message = "pairwise.sandbox.cpus is required.")
    @Pattern(regexp = "^\\d+(\\.\\d+)?$", message = "pairwise.sandbox.cpus must be a numeric value.")
    private String cpus = "0.5";

    @Min(value = 1, message = "pairwise.sandbox.pids-limit must be >= 1.")
    private int pidsLimit = 64;

    @NotBlank(message = "pairwise.sandbox.tmpfs is required.")
    private String tmpfs = "/tmp:rw,noexec,nosuid,size=16m";

    @Min(value = 0, message = "pairwise.sandbox.extra-timeout-buffer-ms must be >= 0.")
    private int extraTimeoutBufferMs = 1000;

    @Min(value = 1024, message = "pairwise.sandbox.max-output-bytes must be >= 1024.")
    private int maxOutputBytes = 65536;

    private boolean enableSelinuxLabel = true;
}
