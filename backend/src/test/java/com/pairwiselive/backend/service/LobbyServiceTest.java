package com.pairwiselive.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.pairwiselive.backend.model.entity.Lobby;
import com.pairwiselive.backend.model.entity.LobbyParticipant;
import com.pairwiselive.backend.model.entity.User;
import com.pairwiselive.backend.model.enums.LobbyStatus;
import com.pairwiselive.backend.repository.ChallengeLanguageRepository;
import com.pairwiselive.backend.repository.ChallengeRepository;
import com.pairwiselive.backend.repository.LobbyDocumentRepository;
import com.pairwiselive.backend.repository.LobbyParticipantRepository;
import com.pairwiselive.backend.repository.LobbyRepository;
import com.pairwiselive.backend.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class LobbyServiceTest {

    @Mock
    private LobbyRepository lobbyRepository;

    @Mock
    private LobbyParticipantRepository lobbyParticipantRepository;

    @Mock
    private LobbyDocumentRepository lobbyDocumentRepository;

    @Mock
    private ChallengeRepository challengeRepository;

    @Mock
    private ChallengeLanguageRepository challengeLanguageRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private LobbyCodeGenerator lobbyCodeGenerator;

    @Mock
    private LobbyAuthorizationService lobbyAuthorizationService;

    @InjectMocks
    private LobbyService lobbyService;

    @Test
    void leaveLobby_whenLastActiveParticipant_closesLobbyWithoutHardDelete() {
        Long lobbyId = 10L;
        Long userId = 7L;

        User user = User.builder().id(userId).build();
        Lobby lobby = Lobby.builder()
            .id(lobbyId)
            .hostUser(user)
            .status(LobbyStatus.WAITING)
            .currentDriverUser(user)
            .build();

        LobbyParticipant participant = LobbyParticipant.builder()
            .id(20L)
            .lobby(lobby)
            .user(user)
            .active(true)
            .build();

        when(lobbyRepository.findById(lobbyId)).thenReturn(Optional.of(lobby));
        when(lobbyParticipantRepository.findByLobbyIdAndUserId(lobbyId, userId)).thenReturn(Optional.of(participant));
        when(lobbyParticipantRepository.findByLobbyIdAndActiveTrueOrderByJoinedAtAsc(lobbyId)).thenReturn(List.of());

        lobbyService.leaveLobby(userId, lobbyId);

        assertFalse(participant.isActive());
        assertNotNull(participant.getLeftAt());
        assertEquals(LobbyStatus.CLOSED, lobby.getStatus());
        assertNull(lobby.getCurrentDriverUser());
        assertNotNull(lobby.getEndedAt());

        verify(lobbyParticipantRepository).save(participant);
        verify(lobbyRepository).save(lobby);
        verify(lobbyDocumentRepository, never()).deleteByLobbyId(lobbyId);
        verify(lobbyParticipantRepository, never()).deleteByLobbyId(lobbyId);
        verify(lobbyRepository, never()).delete(lobby);
    }
}
