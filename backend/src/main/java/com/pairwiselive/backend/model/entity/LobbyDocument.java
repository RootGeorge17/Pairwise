package com.pairwiselive.backend.model.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "lobby_documents")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LobbyDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "lobby_id", nullable = false, unique = true)
    private Lobby lobby;

    @Column(name = "yjs_state_blob", nullable = false, columnDefinition = "LONGBLOB")
    private byte[] yjsStateBlob;

    @Column(name = "plain_text_snapshot", columnDefinition = "LONGTEXT")
    private String plainTextSnapshot;

    @Builder.Default
    @Column(nullable = false, columnDefinition = "INT NOT NULL DEFAULT 0")
    private int version = 0;

    @Column(name = "last_persisted_at", nullable = false)
    private Instant lastPersistedAt;

    @PrePersist
    void onCreate() {
        if (lastPersistedAt == null) {
            lastPersistedAt = Instant.now();
        }
    }
}
