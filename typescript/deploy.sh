#!/bin/bash
set -e

# parse-hcl TypeScript/npm deployment script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
echo_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
echo_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if logged in to npm
check_npm_login() {
    echo_info "Checking npm login status..."
    if ! npm whoami &> /dev/null; then
        echo_error "Not logged in to npm. Please run 'npm login' first."
        exit 1
    fi
    echo_info "Logged in as: $(npm whoami)"
}

# Get current version from package.json
get_version() {
    node -p "require('./package.json').version"
}

# Check if version already exists on npm
check_version_exists() {
    local version=$1
    local package_name=$(node -p "require('./package.json').name")

    if npm view "${package_name}@${version}" version &> /dev/null; then
        echo_error "Version ${version} already exists on npm."
        echo_error "Please bump the version in package.json before deploying."
        exit 1
    fi
}

# Run tests
run_tests() {
    echo_info "Running tests..."
    yarn test
    echo_info "Tests passed!"
}

# Run linting
run_lint() {
    echo_info "Running linter..."
    yarn lint
    echo_info "Linting passed!"
}

# Build the project
build_project() {
    echo_info "Building project..."
    yarn build
    echo_info "Build completed!"
}

# Publish to npm
publish_npm() {
    local version=$1
    local dry_run=$2

    if [ "$dry_run" = true ]; then
        echo_info "Running dry-run publish..."
        npm publish --dry-run
        echo_info "Dry-run completed. Run without --dry-run to actually publish."
    else
        echo_info "Publishing version ${version} to npm..."
        npm publish --access public
        echo_info "Successfully published ${version} to npm!"
    fi
}

# Main deployment flow
main() {
    local dry_run=false
    local skip_tests=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                dry_run=true
                shift
                ;;
            --skip-tests)
                skip_tests=true
                shift
                ;;
            -h|--help)
                echo "Usage: ./deploy.sh [options]"
                echo ""
                echo "Options:"
                echo "  --dry-run      Run publish in dry-run mode (no actual publish)"
                echo "  --skip-tests   Skip running tests before publish"
                echo "  -h, --help     Show this help message"
                exit 0
                ;;
            *)
                echo_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    echo_info "Starting npm deployment process..."
    echo ""

    # Get version
    local version=$(get_version)
    echo_info "Package version: ${version}"
    echo ""

    # Pre-flight checks
    check_npm_login
    check_version_exists "$version"
    echo ""

    # Install dependencies
    echo_info "Installing dependencies..."
    yarn install --frozen-lockfile
    echo ""

    # Build
    build_project
    echo ""

    # Tests & Lint
    if [ "$skip_tests" = false ]; then
        run_tests
        echo ""
        run_lint
        echo ""
    else
        echo_warn "Skipping tests (--skip-tests flag provided)"
        echo ""
    fi

    # Publish
    publish_npm "$version" "$dry_run"

    echo ""
    echo_info "Deployment process completed!"

    if [ "$dry_run" = false ]; then
        echo ""
        echo_info "View your package at:"
        echo "  https://www.npmjs.com/package/parse-hcl"
    fi
}

main "$@"
