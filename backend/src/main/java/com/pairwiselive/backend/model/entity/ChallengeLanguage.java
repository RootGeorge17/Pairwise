package com.pairwiselive.backend.model.entity;

import com.pairwiselive.backend.model.enums.Language;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
    name = "challenge_languages",
    uniqueConstraints = @UniqueConstraint(columnNames = {"challenge_id", "language"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChallengeLanguage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "challenge_id", nullable = false)
    private Challenge challenge;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "ENUM('JAVASCRIPT','PYTHON') NOT NULL")
    private Language language;

    @Column(name = "starter_code", nullable = false, columnDefinition = "LONGTEXT")
    private String starterCode;

    @Column(name = "reference_solution", columnDefinition = "LONGTEXT")
    private String referenceSolution;

    @Column(name = "expected_function_name", nullable = false, length = 100)
    private String expectedFunctionName;

    @Column(name = "entry_filename", nullable = false, length = 100)
    private String entryFilename;

    @Column(name = "docker_image", nullable = false, length = 120)
    private String dockerImage;

    @Builder.Default
    @Column(name = "time_limit_ms", nullable = false, columnDefinition = "INT NOT NULL DEFAULT 2000")
    private int timeLimitMs = 2000;

    @Builder.Default
    @Column(name = "memory_limit_mb", nullable = false, columnDefinition = "INT NOT NULL DEFAULT 128")
    private int memoryLimitMb = 128;

    @Builder.Default
    @Column(name = "is_default", nullable = false, columnDefinition = "BOOLEAN NOT NULL DEFAULT FALSE")
    private boolean defaultLanguage = false;
}
