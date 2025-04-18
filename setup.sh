#!/bin/bash

echo "🚀 Setting up Mox development environment..."

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Bun is not installed. Please install it first."
    echo "   Run: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi

echo "✅ Bun is installed."

# Install dependencies
echo "📦 Installing dependencies..."
bun install

# Set up Husky
echo "🪝 Setting up Husky git hooks..."
bun husky install
chmod +x .husky/pre-commit
chmod +x .husky/_/husky.sh

echo "✨ Setup complete! You can now run:"
echo "   bun run dev    - Start the development server"
echo "   bun run check  - Run all linting and type checking"
echo "   bun run format - Format code"
echo "   bun run lint   - Lint code and fix issues"