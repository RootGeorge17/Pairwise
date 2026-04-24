package com.pairwiselive.backend.websocket;

import com.pairwiselive.backend.security.CustomUserDetails;
import com.pairwiselive.backend.security.JwtService;
import com.pairwiselive.backend.service.LobbyAuthorizationService;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;
import org.springframework.util.MultiValueMap;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtHandshakeInterceptor implements HandshakeInterceptor {

    private final JwtService jwtService;
    private final UserDetailsService userDetailsService;
    private final LobbyAuthorizationService lobbyAuthorizationService;

    @Override
    public boolean beforeHandshake(
        @NonNull ServerHttpRequest request,
        @NonNull ServerHttpResponse response,
        @NonNull WebSocketHandler wsHandler,
        @NonNull Map<String, Object> attributes
    ) {
        if (request instanceof ServletServerHttpRequest servletRequest) {
            // Preferred: /ws/lobbies/{lobbyId}?token=...
            // Legacy fallback: /ws/lobby?token=...&lobbyId=...
            MultiValueMap<String, String> queryParams = UriComponentsBuilder
                .fromUri(servletRequest.getURI())
                .build()
                .getQueryParams();

            String token = queryParams.getFirst("token");
            String lobbyIdParam = resolveLobbyIdParam(servletRequest);

            if (token == null || lobbyIdParam == null) {
                return false; // Reject connection
            }

            try {
                String username = jwtService.extractUsername(token);
                if (username != null) {
                    UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                    if (jwtService.isTokenValid(token, userDetails)) {
                        Long userId = extractUserId(userDetails, token);
                        Long lobbyId = parseLobbyId(lobbyIdParam);

                        if (userId == null || lobbyId == null) {
                            return false;
                        }

                        if (!lobbyAuthorizationService.canAccessLobby(userId, lobbyId)) {
                            return false;
                        }

                        // Pass this data to the WebSocketSession
                        attributes.put("username", username);
                        attributes.put("lobbyId", String.valueOf(lobbyId));
                        attributes.put("userId", userId);
                        return true;
                    }
                }
            } catch (Exception e) {
                log.warn("WebSocket JWT handshake rejected for URI {}: {}", servletRequest.getURI(), e.getMessage(), e);
                return false;
            }
        }
        return false;
    }

    @Override
    public void afterHandshake(
        @NonNull ServerHttpRequest request, 
        @NonNull ServerHttpResponse response,
        @NonNull WebSocketHandler wsHandler, 
        @Nullable Exception exception
    ) {}

    private Long extractUserId(UserDetails userDetails, String token) {
        if (userDetails instanceof CustomUserDetails customUserDetails) {
            return customUserDetails.getId();
        }

        Number claimUserId = jwtService.extractClaim(token, claims -> claims.get("userId", Number.class));
        return claimUserId != null ? claimUserId.longValue() : null;
    }

    private Long parseLobbyId(String lobbyIdParam) {
        try {
            return Long.valueOf(lobbyIdParam);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String resolveLobbyIdParam(ServletServerHttpRequest servletRequest) {
        String lobbyIdFromPath = extractLobbyIdFromPath(servletRequest.getURI().getPath());
        if (lobbyIdFromPath != null) {
            return lobbyIdFromPath;
        }

        MultiValueMap<String, String> queryParams = UriComponentsBuilder
            .fromUri(servletRequest.getURI())
            .build()
            .getQueryParams();

        return queryParams.getFirst("lobbyId");
    }

    private String extractLobbyIdFromPath(String path) {
        if (path == null) {
            return null;
        }

        String prefix = "/ws/lobbies/";
        if (!path.startsWith(prefix)) {
            return null;
        }

        String remainder = path.substring(prefix.length());
        int slashIndex = remainder.indexOf('/');
        String lobbyId = slashIndex >= 0 ? remainder.substring(0, slashIndex) : remainder;

        if (lobbyId.isBlank()) {
            return null;
        }

        return lobbyId;
    }
}
