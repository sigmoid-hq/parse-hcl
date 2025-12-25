#!/bin/bash
set -e

# parse-hcl Python/PyPI deployment script

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

# Check required tools
check_requirements() {
    echo_info "Checking required tools..."

    if ! command -v python &> /dev/null; then
        echo_error "Python is not installed."
        exit 1
    fi

    if ! python -c "import build" &> /dev/null; then
        echo_warn "Installing build package..."
        pip install build
    fi

    if ! python -c "import twine" &> /dev/null; then
        echo_warn "Installing twine package..."
        pip install twine
    fi

    echo_info "All required tools are available."
}

# Get current version from pyproject.toml
get_version() {
    python -c "
import tomllib
with open('pyproject.toml', 'rb') as f:
    data = tomllib.load(f)
    print(data['project']['version'])
"
}

# Check if version already exists on PyPI
check_version_exists() {
    local version=$1
    local package_name="parse-hcl"

    if pip index versions "$package_name" 2>/dev/null | grep -q "$version"; then
        echo_error "Version ${version} already exists on PyPI."
        echo_error "Please bump the version in pyproject.toml before deploying."
        exit 1
    fi

    # Alternative check using PyPI API
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" "https://pypi.org/pypi/${package_name}/${version}/json")
    if [ "$http_code" = "200" ]; then
        echo_error "Version ${version} already exists on PyPI."
        echo_error "Please bump the version in pyproject.toml before deploying."
        exit 1
    fi
}

# Run tests
run_tests() {
    echo_info "Running tests..."
    python -m unittest discover -s tests -v
    echo_info "Tests passed!"
}

# Clean previous builds
clean_build() {
    echo_info "Cleaning previous builds..."
    rm -rf dist/ build/ src/*.egg-info/
    echo_info "Clean completed!"
}

# Build the package
build_package() {
    echo_info "Building package..."
    python -m build
    echo_info "Build completed!"

    echo_info "Built artifacts:"
    ls -la dist/
}

# Check package with twine
check_package() {
    echo_info "Checking package with twine..."
    python -m twine check dist/*
    echo_info "Package check passed!"
}

# Upload to PyPI
upload_pypi() {
    local dry_run=$1
    local use_test_pypi=$2

    if [ "$dry_run" = true ]; then
        echo_info "Dry-run mode: Skipping actual upload."
        echo_info "Would upload the following files:"
        ls -la dist/
        echo_info "Run without --dry-run to actually publish."
    else
        if [ "$use_test_pypi" = true ]; then
            echo_info "Uploading to TestPyPI..."
            python -m twine upload --repository testpypi dist/*
            echo_info "Successfully uploaded to TestPyPI!"
            echo_info "Install with: pip install --index-url https://test.pypi.org/simple/ parse-hcl"
        else
            echo_info "Uploading to PyPI..."
            python -m twine upload dist/*
            echo_info "Successfully uploaded to PyPI!"
        fi
    fi
}

# Main deployment flow
main() {
    local dry_run=false
    local skip_tests=false
    local use_test_pypi=false

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
            --test-pypi)
                use_test_pypi=true
                shift
                ;;
            -h|--help)
                echo "Usage: ./deploy.sh [options]"
                echo ""
                echo "Options:"
                echo "  --dry-run      Build but don't upload (preview mode)"
                echo "  --skip-tests   Skip running tests before publish"
                echo "  --test-pypi    Upload to TestPyPI instead of PyPI"
                echo "  -h, --help     Show this help message"
                echo ""
                echo "Environment variables:"
                echo "  TWINE_USERNAME  PyPI username (or use __token__ for API token)"
                echo "  TWINE_PASSWORD  PyPI password or API token"
                echo ""
                echo "Examples:"
                echo "  ./deploy.sh --dry-run              # Test build without uploading"
                echo "  ./deploy.sh --test-pypi            # Upload to TestPyPI"
                echo "  ./deploy.sh                        # Upload to PyPI"
                exit 0
                ;;
            *)
                echo_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    echo_info "Starting PyPI deployment process..."
    echo ""

    # Pre-flight checks
    check_requirements
    echo ""

    # Get version
    local version=$(get_version)
    echo_info "Package version: ${version}"
    echo ""

    # Check if version exists (skip for test-pypi)
    if [ "$use_test_pypi" = false ] && [ "$dry_run" = false ]; then
        check_version_exists "$version"
    fi
    echo ""

    # Tests
    if [ "$skip_tests" = false ]; then
        run_tests
        echo ""
    else
        echo_warn "Skipping tests (--skip-tests flag provided)"
        echo ""
    fi

    # Clean and build
    clean_build
    echo ""
    build_package
    echo ""

    # Check package
    check_package
    echo ""

    # Upload
    upload_pypi "$dry_run" "$use_test_pypi"

    echo ""
    echo_info "Deployment process completed!"

    if [ "$dry_run" = false ]; then
        echo ""
        if [ "$use_test_pypi" = true ]; then
            echo_info "View your package at:"
            echo "  https://test.pypi.org/project/parse-hcl/"
        else
            echo_info "View your package at:"
            echo "  https://pypi.org/project/parse-hcl/"
        fi
    fi
}

main "$@"
