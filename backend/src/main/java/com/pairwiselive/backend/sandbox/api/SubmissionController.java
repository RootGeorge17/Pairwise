package com.pairwiselive.backend.sandbox.api;

import com.pairwiselive.backend.sandbox.api.dto.SubmitCodeRequest;
import com.pairwiselive.backend.sandbox.api.dto.SubmitCodeResponse;
import com.pairwiselive.backend.sandbox.application.SubmissionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/submissions")
@RequiredArgsConstructor
public class SubmissionController {

    private final SubmissionService submissionService;

    @PostMapping
    public SubmitCodeResponse submitCode(
        @Valid @RequestBody SubmitCodeRequest request,
        @RequestHeader(name = "X-User-Id") Long userId
    ) {
        return submissionService.submitCode(request, userId);
    }
}
