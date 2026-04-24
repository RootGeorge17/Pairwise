package com.pairwiselive.backend.service;

import com.pairwiselive.backend.exception.ApiException;
import com.pairwiselive.backend.exception.BadRequestException;
import com.pairwiselive.backend.exception.ResourceNotFoundException;
import com.pairwiselive.backend.model.dto.lobby.CreateLobbyRequestDTO;
import com.pairwiselive.backend.model.dto.lobby.JoinLobbyRequestDTO;
import com.pairwiselive.backend.model.dto.lobby.LobbyChallengeDTO;
import com.pairwiselive.backend.model.dto.lobby.LobbyLanguageDTO;
import com.pairwiselive.backend.model.dto.lobby.LobbyParticipantDTO;
import com.pairwiselive.backend.model.dto.lobby.LobbyResponseDTO;
import com.pairwiselive.backend.model.dto.lobby.TransferLobbyHostRequestDTO;
import com.pairwiselive.backend.model.dto.lobby.UpdateLobbyParticipantRoleRequestDTO;
import com.pairwiselive.backend.model.dto.lobby.UpdateLobbySettingsRequestDTO;
import com.pairwiselive.backend.model.entity.Challenge;
import com.pairwiselive.backend.model.entity.ChallengeLanguage;
import com.pairwiselive.backend.model.entity.Lobby;
import com.pairwiselive.backend.model.entity.LobbyDocument;
import com.pairwiselive.backend.model.entity.LobbyParticipant;
import com.pairwiselive.backend.model.entity.User;
import com.pairwiselive.backend.model.enums.LobbyStatus;
import com.pairwiselive.backend.model.enums.PairRole;
import com.pairwiselive.backend.repository.ChallengeLanguageRepository;
import com.pairwiselive.backend.repository.ChallengeRepository;
import com.pairwiselive.backend.repository.LobbyDocumentRepository;
import com.pairwiselive.backend.repository.LobbyParticipantRepository;
import com.pairwiselive.backend.repository.LobbyRepository;
import com.pairwiselive.backend.repository.UserRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class LobbyService {

    private static final int MAX_JOIN_CODE_SAVE_RETRIES = 20;
    private static final int DEFAULT_ROTATION_INTERVAL_SECS = 600;
    private static final byte[] EMPTY_YJS_STATE_UPDATE = new byte[] {0, 0};

    private final LobbyRepository lobbyRepository;
    private final LobbyParticipantRepository lobbyParticipantRepository;
    private final LobbyDocumentRepository lobbyDocumentRepository;
    private final ChallengeRepository challengeRepository;
    private final ChallengeLanguageRepository challengeLanguageRepository;
    private final UserRepository userRepository;
    private final LobbyCodeGenerator lobbyCodeGenerator;
    private final LobbyAuthorizationService lobbyAuthorizationService;

    @Transactional
    public LobbyResponseDTO createLobby(Long currentUserId, CreateLobbyRequestDTO request) {
        User hostUser = findUser(currentUserId);
        Challenge challenge = challengeRepository.findById(request.challengeId())
            .orElseThrow(() -> new ResourceNotFoundException("Challenge not found with id: " + request.challengeId()));

        ChallengeLanguage challengeLanguage = challengeLanguageRepository.findById(request.challengeLanguageId())
            .orElseThrow(() -> new ResourceNotFoundException(
                "Challenge language not found with id: " + request.challengeLanguageId()
            ));

        if (!challengeLanguage.getChallenge().getId().equals(challenge.getId())) {
            throw new BadRequestException("Selected language does not belong to the selected challenge.");
        }

        Lobby lobby = Lobby.builder()
            .hostUser(hostUser)
            .challenge(challenge)
            .challengeLanguage(challengeLanguage)
            .name(normalizeName(request.name()))
            .status(LobbyStatus.WAITING)
            .maxParticipants((short) 2)
            .currentDriverUser(hostUser)
            .roleRotationEnabled(resolveRoleRotationEnabled(request.roleRotationEnabled()))
            .rotationIntervalSecs(
                resolveRoleRotationEnabled(request.roleRotationEnabled())
                    ? resolveRotationIntervalSecs(request.rotationIntervalSecs())
                    : null
            )
            .build();

        Lobby savedLobby = saveLobbyWithUniqueJoinCode(lobby);

        lobbyParticipantRepository.save(
            LobbyParticipant.builder()
                .lobby(savedLobby)
                .user(hostUser)
                .pairRole(PairRole.DRIVER)
                .active(true)
                .build()
        );

        lobbyDocumentRepository.save(
            LobbyDocument.builder()
                .lobby(savedLobby)
                .yjsStateBlob(EMPTY_YJS_STATE_UPDATE.clone())
                .plainTextSnapshot("")
                .build()
        );

        return toLobbyResponse(savedLobby, currentUserId);
    }

    @Transactional
    public LobbyResponseDTO joinLobby(Long currentUserId, JoinLobbyRequestDTO request) {
        String normalizedJoinCode = normalizeJoinCode(request.joinCode());

        Lobby lobby = lobbyRepository.findByJoinCodeForUpdate(normalizedJoinCode)
            .orElseThrow(() -> new ResourceNotFoundException("Lobby not found for join code: " + normalizedJoinCode));

        if (lobby.getStatus() == LobbyStatus.CLOSED) {
            throw new BadRequestException("Lobby is closed.");
        }

        User user = findUser(currentUserId);
        Optional<LobbyParticipant> existingParticipant = lobbyParticipantRepository.findByLobbyIdAndUserId(
            lobby.getId(),
            user.getId()
        );

        if (existingParticipant.isPresent() && existingParticipant.get().isActive()) {
            return toLobbyResponse(lobby, currentUserId);
        }

        long activeParticipants = lobbyParticipantRepository.countByLobbyIdAndActiveTrue(lobby.getId());
        if (activeParticipants >= lobby.getMaxParticipants()) {
            throw new BadRequestException("Lobby is full.");
        }

        if (existingParticipant.isPresent()) {
            LobbyParticipant participant = existingParticipant.get();
            participant.setActive(true);
            participant.setLeftAt(null);
            participant.setPairRole(resolveRoleForJoin(activeParticipants));
            lobbyParticipantRepository.save(participant);
        } else {
            lobbyParticipantRepository.save(
                LobbyParticipant.builder()
                    .lobby(lobby)
                    .user(user)
                    .pairRole(resolveRoleForJoin(activeParticipants))
                    .active(true)
                    .build()
            );
        }

        List<LobbyParticipant> updatedActiveParticipants = lobbyParticipantRepository
            .findByLobbyIdAndActiveTrueOrderByJoinedAtAsc(lobby.getId());
        syncCurrentDriverWithRoles(lobby, updatedActiveParticipants);
        lobbyRepository.save(lobby);

        return toLobbyResponse(lobby, currentUserId);
    }

    @Transactional(readOnly = true)
    public List<LobbyResponseDTO> listLobbies(Long currentUserId) {
        return lobbyParticipantRepository.findByUserIdAndActiveTrueOrderByJoinedAtDesc(currentUserId)
            .stream()
            .map(LobbyParticipant::getLobby)
            .map(lobby -> toLobbyResponse(lobby, currentUserId))
            .toList();
    }

    @Transactional(readOnly = true)
    public LobbyResponseDTO getLobby(Long currentUserId, Long lobbyId) {
        Lobby lobby = lobbyRepository.findById(lobbyId)
            .orElseThrow(() -> new ResourceNotFoundException("Lobby not found with id: " + lobbyId));

        if (!lobbyAuthorizationService.canAccessLobby(currentUserId, lobbyId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "You are not a participant of this lobby.");
        }

        return toLobbyResponse(lobby, currentUserId);
    }

    @Transactional
    public void leaveLobby(Long currentUserId, Long lobbyId) {
        Lobby lobby = lobbyRepository.findById(lobbyId)
            .orElseThrow(() -> new ResourceNotFoundException("Lobby not found with id: " + lobbyId));

        LobbyParticipant participant = lobbyParticipantRepository.findByLobbyIdAndUserId(lobbyId, currentUserId)
            .orElseThrow(() -> new ResourceNotFoundException("You are not a participant in this lobby."));

        if (!participant.isActive()) {
            return;
        }

        participant.setActive(false);
        participant.setLeftAt(Instant.now());
        lobbyParticipantRepository.save(participant);

        List<LobbyParticipant> activeParticipants = lobbyParticipantRepository
            .findByLobbyIdAndActiveTrueOrderByJoinedAtAsc(lobbyId);

        if (activeParticipants.isEmpty()) {
            closeEmptyLobby(lobby);
            return;
        }

        User nextActiveUser = activeParticipants.getFirst().getUser();
        if (lobby.getHostUser().getId().equals(currentUserId)) {
            lobby.setHostUser(nextActiveUser);
        }

        syncCurrentDriverWithRoles(lobby, activeParticipants);

        lobbyRepository.save(lobby);
    }

    @Transactional
    public LobbyResponseDTO startLobby(Long currentUserId, Long lobbyId) {
        Lobby lobby = lobbyRepository.findById(lobbyId)
            .orElseThrow(() -> new ResourceNotFoundException("Lobby not found with id: " + lobbyId));

        if (!lobbyAuthorizationService.canAccessLobby(currentUserId, lobbyId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "You are not a participant of this lobby.");
        }

        if (!lobby.getHostUser().getId().equals(currentUserId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only the lobby host can start the lobby.");
        }

        if (lobby.getStatus() == LobbyStatus.CLOSED) {
            throw new BadRequestException("Cannot start a closed lobby.");
        }

        if (lobby.getStatus() != LobbyStatus.ACTIVE) {
            lobby.setStatus(LobbyStatus.ACTIVE);
            if (lobby.getStartedAt() == null) {
                lobby.setStartedAt(Instant.now());
            }
            if (lobby.isRoleRotationEnabled()) {
                lobby.setLastRoleSwitchAt(Instant.now());
            }
        }

        List<LobbyParticipant> activeParticipants = lobbyParticipantRepository
            .findByLobbyIdAndActiveTrueOrderByJoinedAtAsc(lobbyId);
        syncCurrentDriverWithRoles(lobby, activeParticipants);
        if (lobby.getCurrentDriverUser() == null) {
            throw new BadRequestException("Cannot start lobby without an active DRIVER.");
        }

        lobbyRepository.save(lobby);
        return toLobbyResponse(lobby, currentUserId);
    }

    @Transactional
    public LobbyResponseDTO stopLobby(Long currentUserId, Long lobbyId) {
        Lobby lobby = lobbyRepository.findById(lobbyId)
            .orElseThrow(() -> new ResourceNotFoundException("Lobby not found with id: " + lobbyId));

        if (!lobbyAuthorizationService.canAccessLobby(currentUserId, lobbyId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "You are not a participant of this lobby.");
        }

        if (!lobby.getHostUser().getId().equals(currentUserId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only the lobby host can stop the lobby.");
        }

        if (lobby.getStatus() != LobbyStatus.ACTIVE) {
            throw new BadRequestException("Only active lobbies can be stopped.");
        }

        lobby.setStatus(LobbyStatus.WAITING);
        lobby.setStartedAt(null);
        lobby.setLastRoleSwitchAt(null);
        lobbyRepository.save(lobby);
        return toLobbyResponse(lobby, currentUserId);
    }

    @Transactional
    public LobbyResponseDTO rotateLobbyRoles(Long currentUserId, Long lobbyId) {
        Lobby lobby = lobbyRepository.findById(lobbyId)
            .orElseThrow(() -> new ResourceNotFoundException("Lobby not found with id: " + lobbyId));

        if (!lobbyAuthorizationService.canAccessLobby(currentUserId, lobbyId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "You are not a participant of this lobby.");
        }

        if (lobby.getStatus() != LobbyStatus.ACTIVE) {
            throw new BadRequestException("Lobby must be active to rotate roles.");
        }
        if (!lobby.isRoleRotationEnabled()) {
            throw new BadRequestException("Role rotation is disabled.");
        }
        if (lobby.getRotationIntervalSecs() == null || lobby.getRotationIntervalSecs() <= 0) {
            throw new BadRequestException("Rotation interval is not configured.");
        }

        Instant now = Instant.now();
        Instant lastRoleSwitchAt = lobby.getLastRoleSwitchAt() != null ? lobby.getLastRoleSwitchAt() : now;
        long elapsedSeconds = Duration.between(lastRoleSwitchAt, now).getSeconds();
        if (elapsedSeconds < lobby.getRotationIntervalSecs()) {
            throw new BadRequestException("Rotation interval has not elapsed yet.");
        }

        List<LobbyParticipant> activeParticipants = lobbyParticipantRepository
            .findByLobbyIdAndActiveTrueOrderByJoinedAtAsc(lobbyId);

        Optional<LobbyParticipant> driverParticipant = activeParticipants.stream()
            .filter(participant -> participant.getPairRole() == PairRole.DRIVER)
            .findFirst();
        Optional<LobbyParticipant> navigatorParticipant = activeParticipants.stream()
            .filter(participant -> participant.getPairRole() == PairRole.NAVIGATOR)
            .findFirst();

        if (driverParticipant.isEmpty() || navigatorParticipant.isEmpty()) {
            throw new BadRequestException("Rotation requires both active DRIVER and NAVIGATOR participants.");
        }

        driverParticipant.get().setPairRole(PairRole.NAVIGATOR);
        navigatorParticipant.get().setPairRole(PairRole.DRIVER);
        lobbyParticipantRepository.saveAll(activeParticipants);

        syncCurrentDriverWithRoles(lobby, activeParticipants);
        lobby.setLastRoleSwitchAt(now);
        lobbyRepository.save(lobby);
        return toLobbyResponse(lobby, currentUserId);
    }

    @Transactional
    public LobbyResponseDTO updateLobbySettings(
        Long currentUserId,
        Long lobbyId,
        UpdateLobbySettingsRequestDTO request
    ) {
        Lobby lobby = lobbyRepository.findById(lobbyId)
            .orElseThrow(() -> new ResourceNotFoundException("Lobby not found with id: " + lobbyId));

        if (!lobby.getHostUser().getId().equals(currentUserId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only the lobby host can update lobby settings.");
        }
        if (lobby.getStatus() == LobbyStatus.ACTIVE) {
            throw new BadRequestException("Cannot update host settings after lobby start.");
        }

        boolean hasRoleRotationEnabled = request.roleRotationEnabled() != null;
        boolean hasRotationIntervalSecs = request.rotationIntervalSecs() != null;
        if (!hasRoleRotationEnabled && !hasRotationIntervalSecs) {
            throw new BadRequestException("At least one lobby setting must be provided.");
        }

        if (hasRoleRotationEnabled) {
            lobby.setRoleRotationEnabled(request.roleRotationEnabled());
        }
        if (!lobby.isRoleRotationEnabled()) {
            lobby.setRotationIntervalSecs(null);
        } else if (hasRotationIntervalSecs) {
            lobby.setRotationIntervalSecs(request.rotationIntervalSecs());
        } else if (lobby.getRotationIntervalSecs() == null) {
            lobby.setRotationIntervalSecs(DEFAULT_ROTATION_INTERVAL_SECS);
        }

        lobbyRepository.save(lobby);
        return toLobbyResponse(lobby, currentUserId);
    }

    @Transactional
    public LobbyResponseDTO updateParticipantRole(
        Long currentUserId,
        Long lobbyId,
        Long participantUserId,
        UpdateLobbyParticipantRoleRequestDTO request
    ) {
        Lobby lobby = lobbyRepository.findById(lobbyId)
            .orElseThrow(() -> new ResourceNotFoundException("Lobby not found with id: " + lobbyId));
        validateHostAccess(currentUserId, lobby);
        if (lobby.getStatus() == LobbyStatus.ACTIVE) {
            throw new BadRequestException("Cannot update participant roles after lobby start.");
        }

        List<LobbyParticipant> activeParticipants = lobbyParticipantRepository
            .findByLobbyIdAndActiveTrueOrderByJoinedAtAsc(lobbyId);

        LobbyParticipant hostParticipant = findActiveParticipant(activeParticipants, currentUserId)
            .orElseThrow(() -> new BadRequestException("Host must be an active participant."));
        LobbyParticipant targetParticipant = findActiveParticipant(activeParticipants, participantUserId)
            .orElseThrow(() -> new ResourceNotFoundException("Participant not found in this lobby."));

        PairRole requestedRole = request.pairRole();
        if (requestedRole == PairRole.OBSERVER) {
            targetParticipant.setPairRole(PairRole.OBSERVER);
        } else if (!targetParticipant.getUser().getId().equals(currentUserId)
            && hostParticipant.getPairRole() == requestedRole) {
            // Host is giving away their own role: target gets it, host moves to the complementary role.
            targetParticipant.setPairRole(requestedRole);

            PairRole hostNextRole = complementaryPairRole(requestedRole);
            demoteParticipantsWithRole(activeParticipants, requestedRole, currentUserId, participantUserId);
            demoteParticipantsWithRole(activeParticipants, hostNextRole, currentUserId, participantUserId);
            hostParticipant.setPairRole(hostNextRole);
        } else {
            demoteParticipantsWithRole(activeParticipants, requestedRole, participantUserId);
            targetParticipant.setPairRole(requestedRole);
        }

        lobbyParticipantRepository.saveAll(activeParticipants);
        syncCurrentDriverWithRoles(lobby, activeParticipants);
        lobbyRepository.save(lobby);
        return toLobbyResponse(lobby, currentUserId);
    }

    @Transactional
    public LobbyResponseDTO transferHost(Long currentUserId, Long lobbyId, TransferLobbyHostRequestDTO request) {
        Lobby lobby = lobbyRepository.findById(lobbyId)
            .orElseThrow(() -> new ResourceNotFoundException("Lobby not found with id: " + lobbyId));
        validateHostAccess(currentUserId, lobby);
        if (lobby.getStatus() == LobbyStatus.ACTIVE) {
            throw new BadRequestException("Cannot transfer host after lobby start.");
        }

        if (lobby.getHostUser().getId().equals(request.hostUserId())) {
            return toLobbyResponse(lobby, currentUserId);
        }

        LobbyParticipant participant = lobbyParticipantRepository.findByLobbyIdAndUserId(lobbyId, request.hostUserId())
            .orElseThrow(() -> new ResourceNotFoundException("Participant not found in this lobby."));
        if (!participant.isActive()) {
            throw new BadRequestException("Cannot transfer host to an inactive participant.");
        }

        lobby.setHostUser(participant.getUser());
        lobbyRepository.save(lobby);
        return toLobbyResponse(lobby, currentUserId);
    }

    private Lobby saveLobbyWithUniqueJoinCode(Lobby lobby) {
        for (int attempt = 0; attempt < MAX_JOIN_CODE_SAVE_RETRIES; attempt++) {
            lobby.setJoinCode(lobbyCodeGenerator.generateUniqueJoinCode());
            try {
                return lobbyRepository.save(lobby);
            } catch (DataIntegrityViolationException exception) {
                // Retry on join code collisions due to race conditions between generation and insert.
            }
        }

        throw new ApiException(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "JOIN_CODE_GENERATION_FAILED",
            "Failed to generate a unique join code."
        );
    }

    private void closeEmptyLobby(Lobby lobby) {
        lobby.setStatus(LobbyStatus.CLOSED);
        lobby.setEndedAt(Instant.now());
        lobby.setCurrentDriverUser(null);
        lobbyRepository.save(lobby);
    }

    private PairRole resolveRoleForJoin(long activeParticipantsBeforeJoin) {
        if (activeParticipantsBeforeJoin <= 0) {
            return PairRole.DRIVER;
        }
        if (activeParticipantsBeforeJoin == 1) {
            return PairRole.NAVIGATOR;
        }
        return PairRole.OBSERVER;
    }

    private void validateHostAccess(Long currentUserId, Lobby lobby) {
        if (!lobby.getHostUser().getId().equals(currentUserId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Only the lobby host can perform this action.");
        }
    }

    private boolean resolveRoleRotationEnabled(Boolean roleRotationEnabled) {
        return roleRotationEnabled == null || roleRotationEnabled;
    }

    private int resolveRotationIntervalSecs(Integer rotationIntervalSecs) {
        return rotationIntervalSecs == null ? DEFAULT_ROTATION_INTERVAL_SECS : rotationIntervalSecs;
    }

    private void syncCurrentDriverWithRoles(Lobby lobby, List<LobbyParticipant> activeParticipants) {
        User currentDriver = activeParticipants.stream()
            .filter(participant -> participant.getPairRole() == PairRole.DRIVER)
            .map(LobbyParticipant::getUser)
            .findFirst()
            .orElse(null);

        lobby.setCurrentDriverUser(currentDriver);
    }

    private Optional<LobbyParticipant> findActiveParticipant(List<LobbyParticipant> activeParticipants, Long userId) {
        return activeParticipants.stream()
            .filter(participant -> participant.getUser().getId().equals(userId))
            .findFirst();
    }

    private PairRole complementaryPairRole(PairRole role) {
        return role == PairRole.DRIVER ? PairRole.NAVIGATOR : PairRole.DRIVER;
    }

    private void demoteParticipantsWithRole(
        List<LobbyParticipant> participants,
        PairRole role,
        Long... excludedUserIds
    ) {
        for (LobbyParticipant participant : participants) {
            if (participant.getPairRole() != role) {
                continue;
            }
            if (isExcluded(participant.getUser().getId(), excludedUserIds)) {
                continue;
            }
            participant.setPairRole(PairRole.OBSERVER);
        }
    }

    private boolean isExcluded(Long userId, Long... excludedUserIds) {
        for (Long excludedUserId : excludedUserIds) {
            if (userId.equals(excludedUserId)) {
                return true;
            }
        }
        return false;
    }

    private User findUser(Long userId) {
        return userRepository.findById(userId)
            .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));
    }

    private String normalizeJoinCode(String joinCode) {
        return joinCode.trim().toUpperCase(Locale.ROOT);
    }

    private String normalizeName(String name) {
        if (name == null) {
            return null;
        }

        String trimmed = name.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private LobbyResponseDTO toLobbyResponse(Lobby lobby, Long currentUserId) {
        List<LobbyParticipant> activeParticipants = lobbyParticipantRepository
            .findByLobbyIdAndActiveTrueOrderByJoinedAtAsc(lobby.getId());

        List<LobbyParticipantDTO> participants = activeParticipants.stream()
            .map(participant -> new LobbyParticipantDTO(
                participant.getUser().getId(),
                participant.getUser().getUsername(),
                participant.getUser().getDisplayName(),
                participant.getPairRole().name(),
                participant.getJoinedAt()
            ))
            .toList();

        String currentUserRole = activeParticipants.stream()
            .filter(participant -> participant.getUser().getId().equals(currentUserId))
            .map(participant -> participant.getPairRole().name())
            .findFirst()
            .orElse(null);

        LobbyChallengeDTO challenge = new LobbyChallengeDTO(
            lobby.getChallenge().getId(),
            lobby.getChallenge().getSlug(),
            lobby.getChallenge().getTitle(),
            lobby.getChallenge().getDifficulty().name()
        );

        LobbyLanguageDTO language = new LobbyLanguageDTO(
            lobby.getChallengeLanguage().getId(),
            lobby.getChallengeLanguage().getLanguage().name(),
            lobby.getChallengeLanguage().getStarterCode(),
            lobby.getChallengeLanguage().getEntryFilename(),
            lobby.getChallengeLanguage().getTimeLimitMs(),
            lobby.getChallengeLanguage().getMemoryLimitMb(),
            lobby.getChallengeLanguage().isDefaultLanguage()
        );

        return new LobbyResponseDTO(
            lobby.getId(),
            lobby.getJoinCode(),
            lobby.getName(),
            lobby.getStatus().name(),
            lobby.getHostUser().getId(),
            lobby.getCurrentDriverUser() != null ? lobby.getCurrentDriverUser().getId() : null,
            lobby.getMaxParticipants(),
            lobby.isRoleRotationEnabled(),
            lobby.getRotationIntervalSecs(),
            lobby.getLastRoleSwitchAt(),
            lobby.getCreatedAt(),
            lobby.getStartedAt(),
            lobby.getEndedAt(),
            challenge,
            language,
            participants,
            currentUserRole
        );
    }
}
