package com.pairwiselive.backend.repository;

import com.pairwiselive.backend.model.entity.LobbyParticipant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LobbyParticipantRepository extends JpaRepository<LobbyParticipant, Long> {
    Optional<LobbyParticipant> findByLobbyIdAndUserId(Long lobbyId, Long userId);
    List<LobbyParticipant> findByUserIdAndActiveTrueOrderByJoinedAtDesc(Long userId);
    boolean existsByLobbyIdAndUserIdAndActiveTrue(Long lobbyId, Long userId);
    long countByLobbyIdAndActiveTrue(Long lobbyId);
    List<LobbyParticipant> findByLobbyIdAndActiveTrueOrderByJoinedAtAsc(Long lobbyId);
    long deleteByLobbyId(Long lobbyId);
}
