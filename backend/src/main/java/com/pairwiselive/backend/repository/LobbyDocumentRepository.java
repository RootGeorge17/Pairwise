package com.pairwiselive.backend.repository;

import com.pairwiselive.backend.model.entity.LobbyDocument;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LobbyDocumentRepository extends JpaRepository<LobbyDocument, Long> {
    Optional<LobbyDocument> findByLobbyId(Long lobbyId);
    long deleteByLobbyId(Long lobbyId);
}
