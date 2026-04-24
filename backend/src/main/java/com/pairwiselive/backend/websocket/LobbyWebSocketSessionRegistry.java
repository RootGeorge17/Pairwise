package com.pairwiselive.backend.websocket;

import java.util.Collections;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

@Component
public class LobbyWebSocketSessionRegistry {

    private final ConcurrentHashMap<Long, Set<WebSocketSession>> lobbySessions = new ConcurrentHashMap<>();

    public void addSession(Long lobbyId, WebSocketSession session) {
        if (lobbyId == null || session == null) {
            return;
        }
        lobbySessions.computeIfAbsent(lobbyId, key -> new CopyOnWriteArraySet<>()).add(session);
    }

    public void removeSession(Long lobbyId, WebSocketSession session) {
        if (lobbyId == null || session == null) {
            return;
        }

        Set<WebSocketSession> sessions = lobbySessions.get(lobbyId);
        if (sessions == null) {
            return;
        }

        sessions.remove(session);
        if (sessions.isEmpty()) {
            lobbySessions.remove(lobbyId);
        }
    }

    public Set<WebSocketSession> getSessions(Long lobbyId) {
        if (lobbyId == null) {
            return Collections.emptySet();
        }
        return lobbySessions.getOrDefault(lobbyId, Collections.emptySet());
    }

    public int countSessions(Long lobbyId) {
        return getSessions(lobbyId).size();
    }
}
