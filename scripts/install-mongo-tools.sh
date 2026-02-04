#!/bin/bash
# ============================================
# INSTALL MONGODB DATABASE TOOLS (mongoimport)
# ============================================
# mongoimport is 10-50x faster than Node.js for bulk imports
# It uses multiple threads and is written in Go

echo "🔧 Installing MongoDB Database Tools..."

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    echo "📦 Installing via Homebrew (macOS)..."
    brew tap mongodb/brew 2>/dev/null
    brew install mongodb-database-tools
elif [[ -f /etc/debian_version ]]; then
    # Debian/Ubuntu
    echo "📦 Installing on Debian/Ubuntu..."
    wget -qO- https://www.mongodb.org/static/pgp/server-7.0.asc | sudo tee /etc/apt/trusted.gpg.d/mongodb.asc
    echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    sudo apt-get update
    sudo apt-get install -y mongodb-database-tools
elif [[ -f /etc/redhat-release ]]; then
    # RHEL/CentOS/Fedora
    echo "📦 Installing on RHEL/CentOS..."
    cat <<EOF | sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/\$releasever/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
EOF
    sudo yum install -y mongodb-database-tools
else
    echo "❌ Unknown OS. Please install manually from:"
    echo "   https://www.mongodb.com/try/download/database-tools"
    exit 1
fi

# Verify installation
if command -v mongoimport &> /dev/null; then
    echo "✅ mongoimport installed successfully!"
    mongoimport --version
else
    echo "❌ Installation failed. Please install manually."
    exit 1
fi
