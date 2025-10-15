# Claude Code Plugins

A personal marketplace of Claude Code plugins for streamlining development workflows.

## Why This Marketplace?

Custom plugins allow me to automate repetitive tasks and integrate Claude Code deeply with my development workflow. This marketplace keeps all my plugins organized and makes them easy to install and maintain.

## Available Plugins

### PR Review Helper

**What it does:** Streamlines GitHub PR reviews by automatically fetching PR context, CI logs, and Linear tickets in one command.

**Why I built it:** Reviewing PRs at Great Question involves a lot of manual steps:
- Reading PR descriptions, comments, and reviews
- Finding related Linear tickets for context
- Checking CI status across 60+ parallel test jobs (RSpec, Minitest, Jest)
- Downloading and parsing verbose test logs to find actual failures

This plugin automates all of that and presents everything in a token-efficient format.

**Key Features:**
- Zero configuration - auto-detects repository from git remote
- `/pr-review-helper:review-pr <number>` - One command to get everything
- Intelligent log parsing for RSpec, Minitest, and Jest failures
- Linear ticket extraction (works with Linear MCP)
- Compresses CI logs to show only failures (saving thousands of tokens)

**When to use it:** Anytime you're reviewing a PR and need quick context on what changed, what broke, and why.

[View Documentation →](./pr-review-helper/README.md)

## Installation

### 1. Add This Marketplace

```bash
/plugin marketplace add ~/Developer/claude-plugins
```

### 2. Install Plugins

```bash
/plugin install pr-review-helper@rob-marketplace
```

Restart Claude Code when prompted.

## Future Plugins

Ideas for future additions:
- Database migration analyzer
- Code review checklist generator
- Test coverage reporter
- Performance regression detector

## Contributing

These are personal plugins, but feel free to fork and adapt them for your own workflows!

## License

MIT License - see individual plugin directories for details
