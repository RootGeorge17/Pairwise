package com.pairwiselive.backend.sandbox.infrastructure;

import com.pairwiselive.backend.sandbox.domain.SandboxExecutionRequest;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class SandboxFilePreparer {

    public Path prepareWorkspace(
        SandboxExecutionRequest request
    ) throws IOException {
        Path workspace = Files.createTempDirectory("pairwise-run-");

        Path solutionFile = workspace.resolve(request.entryFilename());
        Files.writeString(solutionFile, request.sourceCode(), StandardCharsets.UTF_8);

        Path runnerFile = workspace.resolve("runner.js");
        Files.writeString(runnerFile, buildRunnerScript(request), StandardCharsets.UTF_8);

        setPermissions(workspace, solutionFile, runnerFile);

        return workspace;
    }

    private void setPermissions(
        Path workspace, 
        Path solutionFile, 
        Path runnerFile
    ) {
        try {
            Set<PosixFilePermission> dirPerms =
                PosixFilePermissions.fromString("rwxr-xr-x");   // 755
            Set<PosixFilePermission> filePerms =
                PosixFilePermissions.fromString("rw-r--r--");   // 644

            Files.setPosixFilePermissions(workspace, dirPerms);
            Files.setPosixFilePermissions(solutionFile, filePerms);
            Files.setPosixFilePermissions(runnerFile, filePerms);
        } catch (UnsupportedOperationException | IOException ignored) {
            // Ignore on non-POSIX file systems
        }
    }

    private String buildRunnerScript(
        SandboxExecutionRequest request
    ) {
        return """
            const RESULT_MARKER = '__PAIRWISE_RESULT__';
            const payload = %s;

            function parseExpectedOutput(rawExpectedOutput) {
              if (typeof rawExpectedOutput !== 'string') {
                return rawExpectedOutput;
              }

              const trimmed = rawExpectedOutput.trim();
              if (trimmed.length === 0) {
                return '';
              }

              try {
                return JSON.parse(trimmed);
              } catch {
                return trimmed;
              }
            }

            function deepEqual(left, right) {
              if (Object.is(left, right)) {
                return true;
              }

              if (typeof left !== typeof right) {
                return false;
              }

              if (left === null || right === null) {
                return false;
              }

              if (Array.isArray(left) || Array.isArray(right)) {
                if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
                  return false;
                }

                for (let index = 0; index < left.length; index += 1) {
                  if (!deepEqual(left[index], right[index])) {
                    return false;
                  }
                }
                return true;
              }

              if (typeof left === 'object') {
                const leftKeys = Object.keys(left);
                const rightKeys = Object.keys(right);

                if (leftKeys.length !== rightKeys.length) {
                  return false;
                }

                for (const key of leftKeys) {
                  if (!Object.prototype.hasOwnProperty.call(right, key)) {
                    return false;
                  }
                  if (!deepEqual(left[key], right[key])) {
                    return false;
                  }
                }
                return true;
              }

              return false;
            }

            function serializeActualValue(value) {
              if (typeof value === 'undefined') {
                return 'undefined';
              }

              try {
                const serialized = JSON.stringify(value);
                return typeof serialized === 'string' ? serialized : String(value);
              } catch {
                return String(value);
              }
            }

            function readCurrentMemoryMb() {
              try {
                const usage = process.memoryUsage();
                if (!usage || typeof usage.rss !== 'number' || Number.isNaN(usage.rss)) {
                  return 0;
                }
                return Math.max(0, Math.round(usage.rss / (1024 * 1024)));
              } catch {
                return 0;
              }
            }

            function normalizeTests(rawTests) {
              if (!Array.isArray(rawTests)) {
                return [];
              }

              return rawTests.map((test, index) => ({
                testNumber: Number.isInteger(test?.testNumber) ? test.testNumber : index + 1,
                input: typeof test?.input === 'string' ? test.input : '',
                expectedOutput: typeof test?.expectedOutput === 'string' ? test.expectedOutput : '',
                args: Array.isArray(test?.args) ? test.args : [],
              }));
            }

            function buildFailureResult(tests, status, stderr, exitCode) {
              const testResults = tests.map((test) => ({
                testNumber: test.testNumber,
                passed: false,
                status,
                input: test.input,
                expectedOutput: test.expectedOutput,
                actualOutput: '',
                stdout: '',
                stderr,
                exitCode,
                executionTimeMs: 0,
                memoryUsedMb: readCurrentMemoryMb(),
              }));

              return {
                status: 'FAILED',
                totalTests: tests.length,
                passedTests: 0,
                failedTests: tests.length,
                totalExecutionTimeMs: 0,
                averageExecutionTimeMs: 0,
                peakMemoryUsedMb: readCurrentMemoryMb(),
                testResults,
              };
            }

            async function main() {
              try {
                const tests = normalizeTests(payload?.tests);
                let solution;
                try {
                  const originalLog = console.log;
                  const originalError = console.error;
                  console.log = () => {};
                  console.error = () => {};

                  try {
                    solution = require('./%s');
                  } finally {
                    console.log = originalLog;
                    console.error = originalError;
                  }
                } catch (error) {
                  const loadFailureResult = buildFailureResult(
                    tests,
                    'SANDBOX_ERROR',
                    error?.stack || String(error),
                    1
                  );
                  process.exitCode = 1;
                  process.stdout.write(RESULT_MARKER + JSON.stringify(loadFailureResult));
                  return;
                }

                const fn = solution['%s'];
                if (typeof fn !== 'function') {
                  const failureResult = buildFailureResult(
                    tests,
                    'RUNTIME_ERROR',
                    'Expected function not found: %s',
                    2
                  );
                  process.exitCode = 2;
                  process.stdout.write(RESULT_MARKER + JSON.stringify(failureResult));
                  return;
                }

                const runStart = Date.now();
                let peakMemoryUsedMb = readCurrentMemoryMb();
                let passedTests = 0;
                const testResults = [];

                for (const test of tests) {
                  const testStart = Date.now();
                  let status = 'PASSED';
                  let passed = false;
                  let stderr = '';
                  let exitCode = 0;
                  let actualOutput = '';
                  const capturedErrors = [];

                  const originalLog = console.log;
                  const originalError = console.error;
                  console.log = () => {};
                  console.error = (...messages) => {
                    capturedErrors.push(messages.map((message) => String(message)).join(' '));
                  };

                  try {
                    const result = await fn(...test.args);
                    const expectedOutput = parseExpectedOutput(test.expectedOutput);
                    passed = deepEqual(result, expectedOutput);
                    status = passed ? 'PASSED' : 'WRONG_ANSWER';
                    actualOutput = serializeActualValue(result);
                  } catch (error) {
                    status = 'RUNTIME_ERROR';
                    passed = false;
                    exitCode = 1;
                    capturedErrors.push(error?.stack || String(error));
                  } finally {
                    console.log = originalLog;
                    console.error = originalError;
                  }

                  stderr = capturedErrors.join('\\n');

                  if (passed) {
                    passedTests += 1;
                  }

                  const executionTimeMs = Date.now() - testStart;
                  const memoryUsedMb = readCurrentMemoryMb();
                  peakMemoryUsedMb = Math.max(peakMemoryUsedMb, memoryUsedMb);
                  testResults.push({
                    testNumber: test.testNumber,
                    passed,
                    status,
                    input: test.input,
                    expectedOutput: test.expectedOutput,
                    actualOutput,
                    stdout: actualOutput,
                    stderr,
                    exitCode,
                    executionTimeMs,
                    memoryUsedMb,
                  });
                }

                const totalExecutionTimeMs = Date.now() - runStart;
                const totalTests = testResults.length;
                const failedTests = totalTests - passedTests;
                const averageExecutionTimeMs = totalTests > 0 ? Math.floor(totalExecutionTimeMs / totalTests) : 0;

                process.exitCode = failedTests === 0 ? 0 : 1;
                process.stdout.write(RESULT_MARKER + JSON.stringify({
                  status: failedTests === 0 ? 'PASSED' : 'FAILED',
                  totalTests,
                  passedTests,
                  failedTests,
                  totalExecutionTimeMs,
                  averageExecutionTimeMs,
                  peakMemoryUsedMb,
                  testResults,
                }));
              } catch (error) {
                const catastrophicFailureResult = buildFailureResult(
                  normalizeTests(payload?.tests),
                  'SANDBOX_ERROR',
                  error?.stack || String(error),
                  1
                );
                process.exitCode = 1;
                process.stdout.write(RESULT_MARKER + JSON.stringify(catastrophicFailureResult));
              }
            }

            main();
            """.formatted(
                request.testCasesJson(),
                request.entryFilename(),
                request.expectedFunctionName(),
                request.expectedFunctionName()
            );
    }
}
