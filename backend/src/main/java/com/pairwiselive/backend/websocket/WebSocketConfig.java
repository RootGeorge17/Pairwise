package com.pairwiselive.backend.websocket;

import lombok.RequiredArgsConstructor;
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

    @SuppressWarnings("null")
    @Override
    public void registerWebSocketHandlers(@NonNull WebSocketHandlerRegistry registry) {
        // Preferred route: /ws/lobbies/{lobbyId}?token=...
        // Legacy route kept temporarily for backward compatibility: /ws/lobby?token=...&lobbyId=...
        registry.addHandler(yjsBinaryWebSocketHandler, "/ws/lobbies/*", "/ws/lobby")
                .addInterceptors(jwtHandshakeInterceptor)
                .setAllowedOrigins("http://localhost:5173"); 
    }
}
