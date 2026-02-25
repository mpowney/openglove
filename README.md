# OpenGlove

## Developer Setup

### Prerequisites

This project requires **Node.js 22.x or higher** and **npm 9.x or higher**.

#### Using nvm (Recommended for Mac, Linux, and WSL)

We recommend using [nvm](https://github.com/nvm-sh/nvm) (Node Version Manager) to manage Node.js versions. This ensures you're using a compatible version and makes it easy to switch between projects.

**Install nvm:**

- **Mac and Linux:**
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
  ```

- **WSL (Windows Subsystem for Linux):**
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash
  ```

After installing, reload your shell configuration:
```bash
source ~/.bashrc   # for bash
# or
source ~/.zshrc    # for zsh
```

**Install and use Node.js:**
```bash
nvm install 22
nvm use 22
```

### Installing Dependencies

1. **Install pnpm globally:**
   ```bash
   npm install -g pnpm
   ```

2. **Install project dependencies:**
   ```bash
   pnpm install
   ```

3. **Build and link packages:**
   ```bash
   pnpm build
   ```

   This command creates dependency links between each package in the monorepo workspace, allowing packages to reference each other during development.

### Project Structure

This is a monorepo workspace managed with pnpm. Key packages include:

- `packages/app` - Main application entry point
- `packages/base` - Base classes and utilities for agents and skills
- `packages/skill-web-browser` - Web browser skill implementation

