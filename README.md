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

### Development practice

To develop this solution in VSCode as your IDE on macOS or Linux, open one JavaScript Debug Terminal (terminal 1+n) for each skill package you want to develop / test, plus one JavaScript Debug Terminal (terminal #1) for the main app.

It is also ideal to follow the central log file.

#### Building `@openglove/base`

If you are updating code in the base package, use `pnpm run build` from the solution's root to have those changes reflected to the packages where `@openglove/base` is a dependency. After building the packages, restart the other package(s) that depend on `@openglove/base`

```
pnpm run build
```

#### Terminal 1 (main app including non-containerised skills)

The following will drop the session into a ConsoleChannel (via `packages/app/src/index.ts`)

```
cd packages/app
npm run dev
```

#### Terminal 1+n (containerised skills)

The following runs the Unix socket server so the skill is ready to receive run requests

```
cd packages/skill-web-browser
npm run dev-socket
```

#### Follow log
```
tail -f packages/app/logs/openglove.log
```
