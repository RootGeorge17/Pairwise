package com.pairwiselive.backend.controller;

import com.pairwiselive.backend.sandbox.SandboxExecutionRequest;
import com.pairwiselive.backend.sandbox.SandboxExecutionResult;
import com.pairwiselive.backend.sandbox.SandboxExecutionService;
import com.pairwiselive.backend.sandbox.SandboxRunTestsRequest;
import com.pairwiselive.backend.sandbox.SandboxRunTestsResponse;
import com.pairwiselive.backend.sandbox.SandboxRunner;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sandbox")
@RequiredArgsConstructor
public class SandboxController {

    private final SandboxExecutionService sandboxExecutionService;

    @PostMapping("/run-tests")
    public SandboxRunTestsResponse runTests(@RequestBody SandboxRunTestsRequest request) {
        return sandboxExecutionService.runTests(request);
    }
}
