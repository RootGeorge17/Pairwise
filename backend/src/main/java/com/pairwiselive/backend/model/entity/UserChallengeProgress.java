package com.pairwiselive.backend.model.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(
    name = "user_challenge_progress",
    uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "challenge_id"})
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserChallengeProgress {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "challenge_id", nullable = false)
    private Challenge challenge;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "best_submission_id")
    private Submission bestSubmission;

    @Builder.Default
    @Column(nullable = false, columnDefinition = "BOOLEAN NOT NULL DEFAULT FALSE")
    private boolean solved = false;

    @Builder.Default
    @Column(name = "best_score", nullable = false, columnDefinition = "INT NOT NULL DEFAULT 0")
    private int bestScore = 0;

    @Builder.Default
    @Column(name = "attempt_count", nullable = false, columnDefinition = "INT NOT NULL DEFAULT 0")
    private int attemptCount = 0;

    @Column(name = "first_solved_at")
    private Instant firstSolvedAt;

    @Column(name = "last_attempt_at")
    private Instant lastAttemptAt;
}
