#!/bin/bash
# Build Rust binary for Linux x86_64 from Mac
# This creates a proper Linux binary that can run on your server

set -e

echo "🦀 Building Rust transform binary for Linux x86_64..."

cd "$(dirname "$0")/../rust-transform"

# Install cross-compilation target if not already installed
rustup target add x86_64-unknown-linux-gnu 2>/dev/null || true

# Build for Linux
echo "Building release binary for Linux..."
cargo build --release --target x86_64-unknown-linux-gnu

# Check if build succeeded
if [ -f "target/x86_64-unknown-linux-gnu/release/turbo-transform" ]; then
    echo "✅ Linux binary built successfully!"
    echo "📦 Location: target/x86_64-unknown-linux-gnu/release/turbo-transform"
    echo ""
    echo "To deploy to server:"
    echo "  scp target/x86_64-unknown-linux-gnu/release/turbo-transform root@161.97.80.117:/root/partsform/rust-transform/target/release/"
else
    echo "❌ Build failed"
    exit 1
fi
