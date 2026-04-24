package com.pairwiselive.backend.service;

import com.pairwiselive.backend.model.entity.Lobby;
import com.pairwiselive.backend.model.enums.LobbyStatus;
import com.pairwiselive.backend.repository.LobbyParticipantRepository;
import com.pairwiselive.backend.repository.LobbyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class LobbyAuthorizationService {

    private final LobbyRepository lobbyRepository;
    private final LobbyParticipantRepository lobbyParticipantRepository;

    public boolean canAccessLobby(Long userId, Long lobbyId) {
        if (userId == null || userId <= 0 || lobbyId == null || lobbyId <= 0) {
            return false;
        }

        Lobby lobby = lobbyRepository.findById(lobbyId).orElse(null);
        if (lobby == null) {
            return false;
        }

        if (lobby.getStatus() == LobbyStatus.CLOSED) {
            return false;
        }

        return lobbyParticipantRepository.existsByLobbyIdAndUserIdAndActiveTrue(lobbyId, userId);
    }
}
