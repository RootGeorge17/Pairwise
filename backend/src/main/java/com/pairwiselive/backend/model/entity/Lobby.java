package com.pairwiselive.backend.model.entity;

import com.pairwiselive.backend.model.enums.LobbyStatus;
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
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "lobbies")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Lobby {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "join_code", nullable = false, unique = true, length = 12)
    private String joinCode;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "host_user_id", nullable = false)
    private User hostUser;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "challenge_id", nullable = false)
    private Challenge challenge;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "challenge_language_id", nullable = false)
    private ChallengeLanguage challengeLanguage;

    @Column(length = 120)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "ENUM('WAITING','ACTIVE','CLOSED') NOT NULL DEFAULT 'WAITING'")
    @Builder.Default
    private LobbyStatus status = LobbyStatus.WAITING;

    @Builder.Default
    @Column(name = "max_participants", nullable = false, columnDefinition = "SMALLINT NOT NULL DEFAULT 2")
    private short maxParticipants = 2;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "current_driver_user_id")
    private User currentDriverUser;

    @Builder.Default
    @Column(name = "role_rotation_enabled", nullable = false, columnDefinition = "BOOLEAN NOT NULL DEFAULT TRUE")
    private boolean roleRotationEnabled = true;

    @Column(name = "rotation_interval_secs")
    private Integer rotationIntervalSecs;

    @Column(name = "last_role_switch_at")
    private Instant lastRoleSwitchAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "ended_at")
    private Instant endedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (status == null) {
            status = LobbyStatus.WAITING;
        }
    }
}
