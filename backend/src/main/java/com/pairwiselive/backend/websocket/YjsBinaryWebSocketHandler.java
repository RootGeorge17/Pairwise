package com.pairwiselive.backend.websocket;

import java.io.IOException;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.BinaryWebSocketHandler;

@Slf4j
@Component
@RequiredArgsConstructor
public class YjsBinaryWebSocketHandler extends BinaryWebSocketHandler {

    private final LobbyWebSocketSessionRegistry sessionRegistry;

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        Long lobbyId = parseLobbyId(session);
        String username = (String) session.getAttributes().get("username");

        if (lobbyId == null) {
            return;
        }

        sessionRegistry.addSession(lobbyId, session);
        log.info("User {} joined WebSocket Lobby {}. Total in lobby: {}", username, lobbyId, sessionRegistry.countSessions(lobbyId));
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) {
        Long lobbyId = parseLobbyId(session);
        if (lobbyId == null) {
            return;
        }

        Set<WebSocketSession> sessions = sessionRegistry.getSessions(lobbyId);

        // The dumb relay: broadcast bytes to everyone except sender.
        for (WebSocketSession webSocketSession : sessions) {
            if (webSocketSession.isOpen() && !webSocketSession.getId().equals(session.getId())) {
                try {
                    webSocketSession.sendMessage(message);
                } catch (IOException exception) {
                    log.error("Failed to route binary message to session {}", webSocketSession.getId(), exception);
                }
            }
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Long lobbyId = parseLobbyId(session);
        String username = (String) session.getAttributes().get("username");
        if (lobbyId == null) {
            return;
        }

        sessionRegistry.removeSession(lobbyId, session);
        int remainingSessions = sessionRegistry.countSessions(lobbyId);
        if (remainingSessions == 0) {
            log.info("Lobby {} is empty. Cleaned up websocket sessions.", lobbyId);
        } else {
            log.info("User {} left WebSocket Lobby {}. Remaining sessions: {}", username, lobbyId, remainingSessions);
        }
    }

    private Long parseLobbyId(WebSocketSession session) {
        Object lobbyIdValue = session.getAttributes().get("lobbyId");
        if (lobbyIdValue == null) {
            return null;
        }

        if (lobbyIdValue instanceof Long longValue) {
            return longValue;
        }
        if (lobbyIdValue instanceof Number numberValue) {
            return numberValue.longValue();
        }

        try {
            return Long.valueOf(lobbyIdValue.toString());
        } catch (NumberFormatException exception) {
            return null;
        }
    }
}
