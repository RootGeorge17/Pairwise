package com.pairwiselive.backend.sandbox.api;

import com.pairwiselive.backend.sandbox.api.dto.RunCodeRequest;
import com.pairwiselive.backend.sandbox.api.dto.RunCodeResponse;
import com.pairwiselive.backend.sandbox.application.RunCodeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/execution")
@RequiredArgsConstructor
public class ExecutionController {

    private final RunCodeService runCodeService;

    @PostMapping("/run")
    public RunCodeResponse runCode(
        @Valid @RequestBody RunCodeRequest request
    ) {
        return runCodeService.runCode(request);
    }
}
