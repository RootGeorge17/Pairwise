package com.pairwiselive.backend.exception;

public record ApiFieldError(
    String field,
    String message
) {}
