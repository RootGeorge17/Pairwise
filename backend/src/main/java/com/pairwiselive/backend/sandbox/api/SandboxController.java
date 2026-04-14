package com.pairwiselive.backend.sandbox.api;

import com.pairwiselive.backend.sandbox.api.dto.SandboxRunTestsRequest;
import com.pairwiselive.backend.sandbox.api.dto.SandboxRunTestsResponse;
import com.pairwiselive.backend.sandbox.application.SandboxExecutionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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
    public SandboxRunTestsResponse runTests(
        @Valid @RequestBody SandboxRunTestsRequest request
    ) {
        return sandboxExecutionService.runTests(request);
    }
}
