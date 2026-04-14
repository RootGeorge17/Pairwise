package com.pairwiselive.backend.sandbox.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.pairwiselive.backend.exception.UnprocessableEntityException;
import java.util.Iterator;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SandboxInputMapper {

    private final ObjectMapper objectMapper;

    public String toExecutionInputJson(String rawInputJson) {
        try {
            JsonNode inputNode = objectMapper.readTree(rawInputJson);
            ArrayNode args = toArgsArray(inputNode);

            ObjectNode payload = objectMapper.createObjectNode();
            payload.set("args", args);
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException exception) {
            throw new UnprocessableEntityException("Invalid test case input JSON.");
        }
    }

    private ArrayNode toArgsArray(JsonNode inputNode) {
        ArrayNode args = objectMapper.createArrayNode();

        if (inputNode == null || inputNode.isNull()) {
            return args;
        }

        if (inputNode.isArray()) {
            return (ArrayNode) inputNode;
        }

        if (inputNode.isObject()) {
            JsonNode explicitArgs = inputNode.get("args");
            if (explicitArgs != null && explicitArgs.isArray()) {
                return (ArrayNode) explicitArgs;
            }

            Iterator<Map.Entry<String, JsonNode>> fields = inputNode.fields();
            while (fields.hasNext()) {
                args.add(fields.next().getValue());
            }
            return args;
        }

        args.add(inputNode);
        return args;
    }
}
