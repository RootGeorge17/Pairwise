package com.pairwiselive.backend.service;

import com.pairwiselive.backend.exception.ApiException;
import com.pairwiselive.backend.repository.LobbyRepository;
import java.util.concurrent.ThreadLocalRandom;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class LobbyCodeGenerator {

    private static final String JOIN_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final int MIN_JOIN_CODE_LENGTH = 6;
    private static final int MAX_JOIN_CODE_LENGTH = 8;
    private static final int MAX_GENERATION_ATTEMPTS = 50;

    private final LobbyRepository lobbyRepository;

    public String generateUniqueJoinCode() {
        for (int attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
            String candidate = generateCode();
            if (!lobbyRepository.existsByJoinCode(candidate)) {
                return candidate;
            }
        }

        throw new ApiException(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "JOIN_CODE_GENERATION_FAILED",
            "Failed to generate a unique join code."
        );
    }

    private String generateCode() {
        int length = ThreadLocalRandom.current().nextInt(MIN_JOIN_CODE_LENGTH, MAX_JOIN_CODE_LENGTH + 1);
        StringBuilder code = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            int index = ThreadLocalRandom.current().nextInt(JOIN_CODE_ALPHABET.length());
            code.append(JOIN_CODE_ALPHABET.charAt(index));
        }
        return code.toString();
    }
}
