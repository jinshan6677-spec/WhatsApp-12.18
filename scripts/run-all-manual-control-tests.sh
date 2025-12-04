#!/bin/bash
# Run all manual account control tests
# This script runs unit tests, property tests, and integration tests

echo "========================================"
echo "Manual Account Control - Test Suite"
echo "========================================"
echo ""

echo "[1/4] Running Unit Tests..."
echo "----------------------------------------"
npx electron scripts/test-manual-account-control.js
if [ $? -ne 0 ]; then
    echo "FAILED: Unit Tests"
    exit 1
fi
echo ""

echo "[2/4] Running Property Tests - Part 1..."
echo "----------------------------------------"
npx electron scripts/test-manual-account-control-properties.js
if [ $? -ne 0 ]; then
    echo "FAILED: Property Tests Part 1"
    exit 1
fi
echo ""

echo "[3/4] Running Property Tests - Part 2..."
echo "----------------------------------------"
npx electron scripts/test-manual-account-control-properties-part2.js
if [ $? -ne 0 ]; then
    echo "FAILED: Property Tests Part 2"
    exit 1
fi
echo ""

echo "[4/4] Running End-to-End Integration Tests..."
echo "----------------------------------------"
npx electron scripts/test-manual-account-control-e2e.js
if [ $? -ne 0 ]; then
    echo "FAILED: E2E Integration Tests"
    exit 1
fi
echo ""

echo "========================================"
echo "All Tests Passed!"
echo "========================================"
echo ""
echo "Test Summary:"
echo "- Unit Tests: PASSED"
echo "- Property Tests Part 1: PASSED"
echo "- Property Tests Part 2: PASSED"
echo "- E2E Integration Tests: PASSED"
echo ""
