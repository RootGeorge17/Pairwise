package com.pairwiselive.backend.sandbox.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SandboxOutputComparator {

    private final ObjectMapper objectMapper;

    public boolean areEqual(
        String actualOutput, 
        String expectedOutput
    ) {
        try {
            JsonNode actualNode = objectMapper.readTree(actualOutput);
            JsonNode expectedNode = objectMapper.readTree(expectedOutput);
            return actualNode.equals(expectedNode);
        } catch (JsonProcessingException ignored) {
            return actualOutput.equals(expectedOutput);
        }
    }
}
