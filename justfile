# List recipes
default:
    @just --list

# Install dependencies
install:
    npm install

# Start the dev server
dev:
    npm run dev

# Run unit tests
test:
    npm test

# Type-check
lint:
    npm run typecheck

# Production build
build:
    npm run build
