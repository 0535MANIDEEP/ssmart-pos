#!/bin/bash
# ============================================
# SS Mart — Cross-Platform Build Script (macOS/Linux)
# Builds for: macOS, Linux, Windows (cross-compile)
# ============================================

set -e

echo "========================================"
echo "  SS Mart - Cross-Platform Build"
echo "========================================"
echo ""

# --- Prerequisites Check ---
echo "[1/5] Checking prerequisites..."

command -v node >/dev/null 2>&1 || { echo "ERROR: Node.js not found"; exit 1; }
command -v cargo >/dev/null 2>&1 || { echo "ERROR: Rust not found. Install: https://rustup.rs"; exit 1; }
command -v cargo-tauri >/dev/null 2>&1 || {
    echo "Installing Tauri CLI..."
    cargo install tauri-cli --version "^2"
}

echo "Prerequisites OK."
echo ""

# --- Build Frontend ---
echo "[2/5] Building frontend (Next.js)..."
cd frontend
npx next build
cd ..
echo "Frontend built."
echo ""

# --- Build Backend ---
echo "[3/5] Building backend (TypeScript)..."
cd backend
npx tsc
cd ..
echo "Backend built."
echo ""

# --- Generate Icons ---
echo "[4/5] Generating icons..."
if [ -f "scripts/generate-icons.sh" ]; then
    bash scripts/generate-icons.sh
fi
echo ""

# --- Build Desktop (Tauri) ---
echo "[5/5] Building desktop app (Tauri)..."

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     PLATFORM="linux";;
    Darwin*)    PLATFORM="macos";;
    *)          PLATFORM="unknown"; echo "Unknown OS: ${OS}"; exit 1;;
esac

echo "  Platform: ${PLATFORM}"

# Build for current platform
cargo tauri build

echo ""
echo "========================================"
echo "  Build Complete!"
echo "========================================"
echo ""
echo "Outputs:"
echo "  macOS:   src-tauri/target/release/bundle/dmg/"
echo "  Linux:   src-tauri/target/release/bundle/deb/"
echo "  Windows: src-tauri/target/release/bundle/msi/"
echo ""
