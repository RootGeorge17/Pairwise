package com.pairwiselive.backend.sandbox.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.pairwiselive.backend.exception.UnprocessableEntityException;
import com.pairwiselive.backend.model.entity.TestCase;
import java.util.Iterator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
    @RequiredArgsConstructor
public class SandboxInputMapper {

    private final ObjectMapper objectMapper;

    public String toExecutionTestCasesJson(List<TestCase> testCases) {
        ArrayNode testsNode = objectMapper.createArrayNode();

        for (int index = 0; index < testCases.size(); index++) {
            TestCase testCase = testCases.get(index);
            testsNode.add(toTestNode(testCase, index + 1));
        }

        ObjectNode payloadNode = objectMapper.createObjectNode();
        payloadNode.set("tests", testsNode);

        try {
            return objectMapper.writeValueAsString(payloadNode);
        } catch (JsonProcessingException exception) {
            throw new UnprocessableEntityException("Failed to serialize test case payload.");
        }
    }

    private ObjectNode toTestNode(TestCase testCase, int testNumber) {
        ObjectNode testNode = objectMapper.createObjectNode();
        testNode.put("testNumber", testNumber);
        testNode.put("input", testCase.getInputData());
        testNode.put("expectedOutput", testCase.getExpectedOutput());
        testNode.set("args", toArgsArray(testCase.getInputData(), testCase.getId()));
        return testNode;
    }

    private ArrayNode toArgsArray(String rawInputJson, Long testCaseId) {
        JsonNode inputNode;
        try {
            inputNode = objectMapper.readTree(rawInputJson);
        } catch (JsonProcessingException exception) {
            throw new UnprocessableEntityException("Invalid input JSON in test case id: " + testCaseId);
        }

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

            Iterator<JsonNode> values = inputNode.elements();
            while (values.hasNext()) {
                args.add(values.next());
            }
            return args;
        }

        args.add(inputNode);
        return args;
    }
}
