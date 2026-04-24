package com.pairwiselive.backend.websocket;

import java.util.Arrays;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    private final YjsBinaryWebSocketHandler yjsBinaryWebSocketHandler;
    private final JwtHandshakeInterceptor jwtHandshakeInterceptor;
    @Value("${pairwise.websocket.allowed-origins:${pairwise.cors.allowed-origins:http://localhost:5173}}")
    private String allowedOrigins;

    @SuppressWarnings("null")
    @Override
    public void registerWebSocketHandlers(@NonNull WebSocketHandlerRegistry registry) {
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
            .map(String::trim)
            .filter(origin -> !origin.isEmpty())
            .toList();

        // Preferred route: /ws/lobbies/{lobbyId}?token=...
        // Legacy route kept temporarily for backward compatibility: /ws/lobby?token=...&lobbyId=...
        registry.addHandler(yjsBinaryWebSocketHandler, "/ws/lobbies/*", "/ws/lobby")
                .addInterceptors(jwtHandshakeInterceptor)
                .setAllowedOriginPatterns(origins.toArray(String[]::new));
    }
}
