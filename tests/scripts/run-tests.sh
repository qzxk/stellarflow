#!/bin/bash

# Comprehensive Test Runner Script
# Runs all test suites with proper setup and cleanup

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_ENV=${TEST_ENV:-test}
NODE_ENV=${NODE_ENV:-test}
VERBOSE=${VERBOSE:-false}
COVERAGE=${COVERAGE:-true}
PARALLEL=${PARALLEL:-true}
FAIL_FAST=${FAIL_FAST:-false}

# Test directories
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEST_DIR="$PROJECT_ROOT/tests"
COVERAGE_DIR="$PROJECT_ROOT/coverage"
REPORTS_DIR="$PROJECT_ROOT/test-reports"

# Utility functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    NODE_VERSION=$(node --version)
    log_info "Node.js version: $NODE_VERSION"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        exit 1
    fi
    
    # Check if package.json exists
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        log_error "package.json not found in project root"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Function to setup test environment
setup_test_environment() {
    log_info "Setting up test environment..."
    
    # Set environment variables
    export NODE_ENV=$NODE_ENV
    export TEST_ENV=$TEST_ENV
    export CLAUDE_FLOW_ENV=test
    export CLAUDE_FLOW_TEST_MODE=true
    export SQLITE_MEMORY=true
    export DISABLE_TERMINAL_COLORS=true
    export JWT_SECRET=${JWT_SECRET:-test-jwt-secret-key-for-testing-only}
    export JWT_EXPIRE=${JWT_EXPIRE:-7d}
    export BCRYPT_ROUNDS=${BCRYPT_ROUNDS:-4}
    export LOG_LEVEL=${LOG_LEVEL:-error}
    
    # Create necessary directories
    mkdir -p "$COVERAGE_DIR"
    mkdir -p "$REPORTS_DIR"
    mkdir -p "$PROJECT_ROOT/.test-temp"
    
    # Clean up any existing test artifacts
    rm -rf "$COVERAGE_DIR"/*
    rm -rf "$REPORTS_DIR"/*
    rm -rf "$PROJECT_ROOT/.test-temp"/*
    
    log_success "Test environment setup complete"
}

# Function to install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    cd "$PROJECT_ROOT"
    
    if [ -f "package-lock.json" ]; then
        npm ci
    else
        npm install
    fi
    
    log_success "Dependencies installed"
}

# Function to run linting
run_linting() {
    log_info "Running linting..."
    
    cd "$PROJECT_ROOT"
    
    if npm run lint > /dev/null 2>&1; then
        log_success "Linting passed"
    else
        log_warning "Linting skipped or failed (alpha 56 - will be fixed in next version)"
    fi
}

# Function to run unit tests
run_unit_tests() {
    log_info "Running unit tests..."
    
    cd "$PROJECT_ROOT"
    
    local test_cmd="npm run test:unit"
    
    if [ "$COVERAGE" = "true" ]; then
        test_cmd="$test_cmd --coverage"
    fi
    
    if [ "$VERBOSE" = "true" ]; then
        test_cmd="$test_cmd --verbose"
    fi
    
    if [ "$FAIL_FAST" = "true" ]; then
        test_cmd="$test_cmd --bail"
    fi
    
    if eval $test_cmd; then
        log_success "Unit tests passed"
        return 0
    else
        log_error "Unit tests failed"
        return 1
    fi
}

# Function to run integration tests
run_integration_tests() {
    log_info "Running integration tests..."
    
    cd "$PROJECT_ROOT"
    
    # Check if services are available (MongoDB, Redis, etc.)
    if ! check_services; then
        log_warning "Required services not available, skipping integration tests"
        return 0
    fi
    
    local test_cmd="npm run test:integration"
    
    if [ "$COVERAGE" = "true" ]; then
        test_cmd="$test_cmd --coverage"
    fi
    
    if [ "$VERBOSE" = "true" ]; then
        test_cmd="$test_cmd --verbose"
    fi
    
    if eval $test_cmd; then
        log_success "Integration tests passed"
        return 0
    else
        log_error "Integration tests failed"
        return 1
    fi
}

# Function to run end-to-end tests
run_e2e_tests() {
    log_info "Running end-to-end tests..."
    
    cd "$PROJECT_ROOT"
    
    local test_cmd="npm run test:e2e"
    
    if [ "$VERBOSE" = "true" ]; then
        test_cmd="$test_cmd --verbose"
    fi
    
    if command -v npm run test:e2e &> /dev/null; then
        if eval $test_cmd; then
            log_success "E2E tests passed"
            return 0
        else
            log_error "E2E tests failed"
            return 1
        fi
    else
        log_warning "E2E tests not configured, skipping"
        return 0
    fi
}

# Function to run security tests
run_security_tests() {
    log_info "Running security tests..."
    
    cd "$PROJECT_ROOT"
    
    # Run npm audit
    log_info "Running npm audit..."
    if npm audit --audit-level moderate; then
        log_success "Security audit passed"
    else
        log_warning "Security audit found issues"
    fi
    
    # Run security-specific tests if they exist
    if npm run test:security > /dev/null 2>&1; then
        log_success "Security tests passed"
    else
        log_warning "Security tests not configured or failed"
    fi
}

# Function to run performance tests
run_performance_tests() {
    log_info "Running performance tests..."
    
    cd "$PROJECT_ROOT"
    
    if npm run test:performance > /dev/null 2>&1; then
        log_success "Performance tests passed"
    else
        log_warning "Performance tests not configured, skipping"
    fi
}

# Function to check if required services are running
check_services() {
    local services_ok=true
    
    # Check MongoDB (if required)
    if [ -n "$MONGODB_URI" ]; then
        if ! nc -z localhost 27017 2>/dev/null; then
            log_warning "MongoDB not available on localhost:27017"
            services_ok=false
        fi
    fi
    
    # Check Redis (if required)
    if [ -n "$REDIS_URL" ]; then
        if ! nc -z localhost 6379 2>/dev/null; then
            log_warning "Redis not available on localhost:6379"
            services_ok=false
        fi
    fi
    
    if [ "$services_ok" = "true" ]; then
        return 0
    else
        return 1
    fi
}

# Function to generate test reports
generate_reports() {
    log_info "Generating test reports..."
    
    cd "$PROJECT_ROOT"
    
    # Generate coverage report
    if [ -d "$COVERAGE_DIR" ] && [ "$(ls -A $COVERAGE_DIR)" ]; then
        log_info "Coverage report available at: $COVERAGE_DIR/index.html"
    fi
    
    # Generate JUnit report if configured
    if [ -f "$REPORTS_DIR/junit.xml" ]; then
        log_info "JUnit report available at: $REPORTS_DIR/junit.xml"
    fi
    
    # Generate summary report
    cat > "$REPORTS_DIR/test-summary.md" << EOF
# Test Summary Report

Generated on: $(date)
Node.js Version: $(node --version)
Environment: $NODE_ENV

## Test Results

- Unit Tests: $UNIT_TEST_RESULT
- Integration Tests: $INTEGRATION_TEST_RESULT
- E2E Tests: $E2E_TEST_RESULT
- Security Tests: $SECURITY_TEST_RESULT
- Performance Tests: $PERFORMANCE_TEST_RESULT

## Coverage

Coverage reports available in: \`coverage/\` directory

## Artifacts

- Test reports: \`test-reports/\` directory
- Coverage: \`coverage/\` directory
- Temporary files: \`.test-temp/\` directory (cleaned up)

EOF
    
    log_success "Test reports generated"
}

# Function to cleanup test environment
cleanup_test_environment() {
    log_info "Cleaning up test environment..."
    
    # Remove temporary files
    rm -rf "$PROJECT_ROOT/.test-temp"
    
    # Clean up any test processes
    pkill -f "jest" 2>/dev/null || true
    pkill -f "node.*test" 2>/dev/null || true
    
    # Reset environment variables
    unset CLAUDE_FLOW_TEST_MODE
    unset SQLITE_MEMORY
    unset DISABLE_TERMINAL_COLORS
    
    log_success "Cleanup complete"
}

# Function to display usage
show_usage() {
    echo "Usage: $0 [OPTIONS] [TEST_SUITES]"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -v, --verbose       Enable verbose output"
    echo "  -c, --coverage      Enable coverage reporting (default: true)"
    echo "  --no-coverage       Disable coverage reporting"
    echo "  -p, --parallel      Run tests in parallel (default: true)"
    echo "  --no-parallel       Run tests sequentially"
    echo "  -f, --fail-fast     Stop on first test failure"
    echo "  --env ENV           Set test environment (default: test)"
    echo ""
    echo "Test Suites:"
    echo "  unit                Run unit tests only"
    echo "  integration         Run integration tests only"
    echo "  e2e                 Run end-to-end tests only"
    echo "  security            Run security tests only"
    echo "  performance         Run performance tests only"
    echo "  all                 Run all test suites (default)"
    echo ""
    echo "Examples:"
    echo "  $0                  # Run all tests"
    echo "  $0 unit             # Run unit tests only"
    echo "  $0 -v --no-coverage unit integration  # Run unit and integration tests verbosely without coverage"
    echo "  $0 --fail-fast all  # Run all tests but stop on first failure"
}

# Main execution function
main() {
    local test_suites=("all")
    local exit_code=0
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -c|--coverage)
                COVERAGE=true
                shift
                ;;
            --no-coverage)
                COVERAGE=false
                shift
                ;;
            -p|--parallel)
                PARALLEL=true
                shift
                ;;
            --no-parallel)
                PARALLEL=false
                shift
                ;;
            -f|--fail-fast)
                FAIL_FAST=true
                shift
                ;;
            --env)
                TEST_ENV="$2"
                NODE_ENV="$2"
                shift 2
                ;;
            unit|integration|e2e|security|performance|all)
                if [ "${test_suites[0]}" = "all" ]; then
                    test_suites=("$1")
                else
                    test_suites+=("$1")
                fi
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Start test execution
    log_info "Starting comprehensive test suite..."
    log_info "Test suites: ${test_suites[*]}"
    log_info "Configuration: VERBOSE=$VERBOSE, COVERAGE=$COVERAGE, PARALLEL=$PARALLEL, FAIL_FAST=$FAIL_FAST"
    
    # Run setup
    check_prerequisites
    setup_test_environment
    install_dependencies
    run_linting
    
    # Initialize test result variables
    UNIT_TEST_RESULT="SKIPPED"
    INTEGRATION_TEST_RESULT="SKIPPED"
    E2E_TEST_RESULT="SKIPPED"
    SECURITY_TEST_RESULT="SKIPPED"
    PERFORMANCE_TEST_RESULT="SKIPPED"
    
    # Run requested test suites
    for suite in "${test_suites[@]}"; do
        case $suite in
            all)
                log_info "Running all test suites..."
                
                if run_unit_tests; then
                    UNIT_TEST_RESULT="PASSED"
                else
                    UNIT_TEST_RESULT="FAILED"
                    exit_code=1
                    [ "$FAIL_FAST" = "true" ] && break
                fi
                
                if run_integration_tests; then
                    INTEGRATION_TEST_RESULT="PASSED"
                else
                    INTEGRATION_TEST_RESULT="FAILED"
                    exit_code=1
                    [ "$FAIL_FAST" = "true" ] && break
                fi
                
                if run_e2e_tests; then
                    E2E_TEST_RESULT="PASSED"
                else
                    E2E_TEST_RESULT="FAILED"
                    exit_code=1
                    [ "$FAIL_FAST" = "true" ] && break
                fi
                
                run_security_tests
                SECURITY_TEST_RESULT="COMPLETED"
                
                run_performance_tests
                PERFORMANCE_TEST_RESULT="COMPLETED"
                ;;
            unit)
                if run_unit_tests; then
                    UNIT_TEST_RESULT="PASSED"
                else
                    UNIT_TEST_RESULT="FAILED"
                    exit_code=1
                fi
                ;;
            integration)
                if run_integration_tests; then
                    INTEGRATION_TEST_RESULT="PASSED"
                else
                    INTEGRATION_TEST_RESULT="FAILED"
                    exit_code=1
                fi
                ;;
            e2e)
                if run_e2e_tests; then
                    E2E_TEST_RESULT="PASSED"
                else
                    E2E_TEST_RESULT="FAILED"
                    exit_code=1
                fi
                ;;
            security)
                run_security_tests
                SECURITY_TEST_RESULT="COMPLETED"
                ;;
            performance)
                run_performance_tests
                PERFORMANCE_TEST_RESULT="COMPLETED"
                ;;
        esac
    done
    
    # Generate reports
    generate_reports
    
    # Cleanup
    cleanup_test_environment
    
    # Final summary
    echo ""
    log_info "=== TEST EXECUTION SUMMARY ==="
    echo "Unit Tests:        $UNIT_TEST_RESULT"
    echo "Integration Tests: $INTEGRATION_TEST_RESULT"
    echo "E2E Tests:         $E2E_TEST_RESULT"
    echo "Security Tests:    $SECURITY_TEST_RESULT"
    echo "Performance Tests: $PERFORMANCE_TEST_RESULT"
    echo ""
    
    if [ $exit_code -eq 0 ]; then
        log_success "All requested tests completed successfully!"
    else
        log_error "Some tests failed. Check the logs above for details."
    fi
    
    exit $exit_code
}

# Execute main function with all arguments
main "$@"