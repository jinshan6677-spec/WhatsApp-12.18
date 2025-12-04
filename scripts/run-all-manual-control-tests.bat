@echo off
REM Run all manual account control tests
REM This script runs unit tests, property tests, and integration tests

echo ========================================
echo Manual Account Control - Test Suite
echo ========================================
echo.

echo [1/4] Running Unit Tests...
echo ----------------------------------------
call npx electron scripts/test-manual-account-control.js
if %ERRORLEVEL% NEQ 0 (
    echo FAILED: Unit Tests
    exit /b 1
)
echo.

echo [2/4] Running Property Tests - Part 1...
echo ----------------------------------------
call npx electron scripts/test-manual-account-control-properties.js
if %ERRORLEVEL% NEQ 0 (
    echo FAILED: Property Tests Part 1
    exit /b 1
)
echo.

echo [3/4] Running Property Tests - Part 2...
echo ----------------------------------------
call npx electron scripts/test-manual-account-control-properties-part2.js
if %ERRORLEVEL% NEQ 0 (
    echo FAILED: Property Tests Part 2
    exit /b 1
)
echo.

echo [4/4] Running End-to-End Integration Tests...
echo ----------------------------------------
call npx electron scripts/test-manual-account-control-e2e.js
if %ERRORLEVEL% NEQ 0 (
    echo FAILED: E2E Integration Tests
    exit /b 1
)
echo.

echo ========================================
echo All Tests Passed!
echo ========================================
echo.
echo Test Summary:
echo - Unit Tests: PASSED
echo - Property Tests Part 1: PASSED
echo - Property Tests Part 2: PASSED
echo - E2E Integration Tests: PASSED
echo.
