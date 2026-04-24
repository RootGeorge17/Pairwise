package com.pairwiselive.backend.service;

import com.pairwiselive.backend.exception.ApiException;
import com.pairwiselive.backend.exception.ResourceNotFoundException;
import com.pairwiselive.backend.model.entity.Lobby;
import com.pairwiselive.backend.model.entity.LobbyDocument;
import com.pairwiselive.backend.repository.LobbyDocumentRepository;
import com.pairwiselive.backend.repository.LobbyRepository;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class LobbyDocumentService {

    private static final byte[] EMPTY_YJS_STATE_UPDATE = new byte[] {0, 0};

    private final LobbyDocumentRepository lobbyDocumentRepository;
    private final LobbyRepository lobbyRepository;
    private final LobbyAuthorizationService lobbyAuthorizationService;

    @Transactional(readOnly = true)
    public byte[] loadYjsState(Long userId, Long lobbyId) {
        ensureLobbyAccess(userId, lobbyId);
        return lobbyDocumentRepository.findByLobbyId(lobbyId)
            .map(document -> document.getYjsStateBlob().clone())
            .orElse(EMPTY_YJS_STATE_UPDATE.clone());
    }

    @Transactional
    public void saveYjsState(Long userId, Long lobbyId, byte[] yjsState, String plainTextSnapshot) {
        ensureLobbyAccess(userId, lobbyId);

        LobbyDocument document = lobbyDocumentRepository.findByLobbyId(lobbyId)
            .orElseGet(() -> LobbyDocument.builder()
                .lobby(findLobby(lobbyId))
                .yjsStateBlob(EMPTY_YJS_STATE_UPDATE.clone())
                .plainTextSnapshot("")
                .build()
            );

        byte[] nextState = yjsState == null || yjsState.length == 0
            ? EMPTY_YJS_STATE_UPDATE.clone()
            : yjsState.clone();

        document.setYjsStateBlob(nextState);
        if (plainTextSnapshot != null) {
            document.setPlainTextSnapshot(plainTextSnapshot);
        }
        document.setVersion(document.getVersion() + 1);
        document.setLastPersistedAt(Instant.now());
        lobbyDocumentRepository.save(document);
    }

    private Lobby findLobby(Long lobbyId) {
        return lobbyRepository.findById(lobbyId)
            .orElseThrow(() -> new ResourceNotFoundException("Lobby not found with id: " + lobbyId));
    }

    private void ensureLobbyAccess(Long userId, Long lobbyId) {
        if (!lobbyAuthorizationService.canAccessLobby(userId, lobbyId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "You are not a participant of this lobby.");
        }
    }
}
