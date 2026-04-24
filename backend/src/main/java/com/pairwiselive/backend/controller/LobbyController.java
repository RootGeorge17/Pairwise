package com.pairwiselive.backend.controller;

import com.pairwiselive.backend.exception.ApiException;
import com.pairwiselive.backend.model.dto.lobby.CreateLobbyRequestDTO;
import com.pairwiselive.backend.model.dto.lobby.JoinLobbyRequestDTO;
import com.pairwiselive.backend.model.dto.lobby.LobbyResponseDTO;
import com.pairwiselive.backend.model.dto.lobby.TransferLobbyHostRequestDTO;
import com.pairwiselive.backend.model.dto.lobby.UpdateLobbyParticipantRoleRequestDTO;
import com.pairwiselive.backend.model.dto.lobby.UpdateLobbySettingsRequestDTO;
import com.pairwiselive.backend.security.CustomUserDetails;
import com.pairwiselive.backend.service.LobbyDocumentService;
import com.pairwiselive.backend.service.LobbyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
@RequestMapping("/api/lobbies")
@RequiredArgsConstructor
public class LobbyController {

    private final LobbyService lobbyService;
    private final LobbyDocumentService lobbyDocumentService;

    @PostMapping
    public ResponseEntity<LobbyResponseDTO> createLobby(
        @AuthenticationPrincipal CustomUserDetails currentUser,
        @Valid @RequestBody CreateLobbyRequestDTO request
    ) {
        LobbyResponseDTO lobby = lobbyService.createLobby(requireUserId(currentUser), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(lobby);
    }

    @PostMapping("/join")
    public ResponseEntity<LobbyResponseDTO> joinLobby(
        @AuthenticationPrincipal CustomUserDetails currentUser,
        @Valid @RequestBody JoinLobbyRequestDTO request
    ) {
        return ResponseEntity.ok(lobbyService.joinLobby(requireUserId(currentUser), request));
    }

    @GetMapping
    public ResponseEntity<List<LobbyResponseDTO>> listLobbies(
        @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        return ResponseEntity.ok(lobbyService.listLobbies(requireUserId(currentUser)));
    }

    @GetMapping("/{id}")
    public ResponseEntity<LobbyResponseDTO> getLobby(
        @AuthenticationPrincipal CustomUserDetails currentUser,
        @PathVariable Long id
    ) {
        return ResponseEntity.ok(lobbyService.getLobby(requireUserId(currentUser), id));
    }

    @PostMapping("/{id}/leave")
    public ResponseEntity<Void> leaveLobby(
        @AuthenticationPrincipal CustomUserDetails currentUser,
        @PathVariable Long id
    ) {
        lobbyService.leaveLobby(requireUserId(currentUser), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/start")
    public ResponseEntity<LobbyResponseDTO> startLobby(
        @AuthenticationPrincipal CustomUserDetails currentUser,
        @PathVariable Long id
    ) {
        return ResponseEntity.ok(lobbyService.startLobby(requireUserId(currentUser), id));
    }

    @PostMapping("/{id}/stop")
    public ResponseEntity<LobbyResponseDTO> stopLobby(
        @AuthenticationPrincipal CustomUserDetails currentUser,
        @PathVariable Long id
    ) {
        return ResponseEntity.ok(lobbyService.stopLobby(requireUserId(currentUser), id));
    }

    @PostMapping("/{id}/rotate")
    public ResponseEntity<LobbyResponseDTO> rotateLobbyRoles(
        @AuthenticationPrincipal CustomUserDetails currentUser,
        @PathVariable Long id
    ) {
        return ResponseEntity.ok(lobbyService.rotateLobbyRoles(requireUserId(currentUser), id));
    }

    @PatchMapping("/{id}/settings")
    public ResponseEntity<LobbyResponseDTO> updateLobbySettings(
        @AuthenticationPrincipal CustomUserDetails currentUser,
        @PathVariable Long id,
        @Valid @RequestBody UpdateLobbySettingsRequestDTO request
    ) {
        return ResponseEntity.ok(lobbyService.updateLobbySettings(requireUserId(currentUser), id, request));
    }

    @PatchMapping("/{id}/participants/{userId}/role")
    public ResponseEntity<LobbyResponseDTO> updateParticipantRole(
        @AuthenticationPrincipal CustomUserDetails currentUser,
        @PathVariable Long id,
        @PathVariable Long userId,
        @Valid @RequestBody UpdateLobbyParticipantRoleRequestDTO request
    ) {
        return ResponseEntity.ok(lobbyService.updateParticipantRole(requireUserId(currentUser), id, userId, request));
    }

    @PatchMapping("/{id}/host")
    public ResponseEntity<LobbyResponseDTO> transferHost(
        @AuthenticationPrincipal CustomUserDetails currentUser,
        @PathVariable Long id,
        @Valid @RequestBody TransferLobbyHostRequestDTO request
    ) {
        return ResponseEntity.ok(lobbyService.transferHost(requireUserId(currentUser), id, request));
    }

    @GetMapping(value = "/{id}/document", produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public ResponseEntity<byte[]> getLobbyDocument(
        @AuthenticationPrincipal CustomUserDetails currentUser,
        @PathVariable Long id
    ) {
        byte[] state = lobbyDocumentService.loadYjsState(requireUserId(currentUser), id);
        return ResponseEntity.ok()
            .contentType(MediaType.APPLICATION_OCTET_STREAM)
            .body(state);
    }

    @PutMapping(value = "/{id}/document", consumes = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public ResponseEntity<Void> putLobbyDocument(
        @AuthenticationPrincipal CustomUserDetails currentUser,
        @PathVariable Long id,
        @RequestBody byte[] yjsState,
        @RequestParam(required = false) String plainTextSnapshot
    ) {
        lobbyDocumentService.saveYjsState(requireUserId(currentUser), id, yjsState, plainTextSnapshot);
        return ResponseEntity.noContent().build();
    }

    private Long requireUserId(CustomUserDetails currentUser) {
        if (currentUser == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Authentication is required.");
        }
        return currentUser.getId();
    }
}
