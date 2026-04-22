package com.pairwiselive.backend.sandbox.api;

import com.pairwiselive.backend.exception.ApiException;
import com.pairwiselive.backend.security.CustomUserDetails;
import com.pairwiselive.backend.sandbox.api.dto.SubmitCodeRequest;
import com.pairwiselive.backend.sandbox.api.dto.SubmitCodeResponse;
import com.pairwiselive.backend.sandbox.application.SubmissionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
        @AuthenticationPrincipal CustomUserDetails currentUser
    ) {
        if (currentUser == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Authentication is required.");
        }
        return submissionService.submitCode(request, currentUser.getId());
    }
}
