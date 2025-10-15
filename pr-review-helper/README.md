# PR Review Helper

An MCP server plugin for Claude Code that streamlines PR reviews by automatically fetching PR context, Linear tickets, and compressed CI failure logs. Works with any GitHub repository - no configuration needed!

## Problem

Reviewing PRs involves several manual steps:
- Reading PR description, comments, and reviews
- Finding the related Linear ticket for context
- Checking CI status across parallel jobs
- Downloading and parsing test logs from multiple artifacts
- Identifying the actual test failures in verbose logs

This MCP automates all of these steps and presents the information in a token-efficient format.

## Features

- **Zero Configuration**: Automatically detects repository from git remote - works with any GitHub repo!
- **Comprehensive PR Context**: Fetches PR details, comments, reviews, and commits in one call
- **Linear Integration**: Extracts Linear ticket IDs and integrates with Linear MCP for full context
- **CI Status Tracking**: Lists all CI runs and identifies failing jobs
- **Intelligent Log Parsing**: Extracts only test failures from RSpec, Minitest, and Jest logs
- **Token Efficiency**: Compresses logs to show only relevant failure information
- **Simple Usage**: Just `/review-pr <number>` - no setup required!

## Installation

### Quick Install from GitHub

```bash
/plugin marketplace add https://github.com/Robdel12/claude-plugins
/plugin install pr-review-helper@rob-marketplace
```

Restart Claude Code when prompted.

### Local Development Install

If you've cloned the repository locally:

```bash
/plugin marketplace add ~/Developer/claude-plugins
/plugin install pr-review-helper@rob-marketplace
```

### Authentication

The MCP server automatically uses `gh` CLI for authentication. Just make sure you're logged in:

```bash
gh auth login
```

That's it! The plugin automatically detects your repository from git remote.

> **Note**: If you prefer to use a personal access token instead, you can set the `GITHUB_TOKEN` environment variable and it will use that.

## Usage

### Quick Start with Slash Command

The easiest way to review a PR - just provide the PR number:

```
/review-pr 16375
```

This automatically:
1. Detects your repository from git remote
2. Fetches all PR details (description, comments, reviews)
3. Extracts Linear ticket IDs (if any)
4. Uses Linear MCP to fetch full ticket context
5. Checks CI status across all jobs
6. Parses and compresses failing test logs
7. Presents everything in a structured, actionable format

**Note**: If you have the Linear MCP installed, it will automatically fetch full ticket details for any Linear IDs found in the PR.

### Working Outside a Git Repository

If you're not in a git repository directory (e.g., you're in a parent directory), you can explicitly pass the owner and repo:

```
Use the full_pr_review_context tool with owner: "GreatQuestion", repo: "great_question", pr_number: 16375, and include_logs: true
```

### Manual Tool Usage

You can also use the MCP tools directly for more control:

#### Get Full PR Context
```
Use the full_pr_review_context tool with pr_number: 1234 and include_logs: true
```

#### Get Only CI Status
```
Use the get_ci_summary tool with pr_number: 1234
```

#### Get Specific Job Logs
```
Use the get_job_logs tool with job_id: 123456 and job_name: "rspec_suite (0)"
```

#### Extract Linear Tickets
```
Use the extract_linear_tickets tool with pr_number: 1234
```

## Available MCP Tools

### `get_pr_details`
Get comprehensive PR details including description, comments, reviews, and commits.

**Parameters:**
- `pr_number` (number): The PR number
- `owner` (string, optional): Repository owner (auto-detected if not provided)
- `repo` (string, optional): Repository name (auto-detected if not provided)

### `get_ci_summary`
Get CI status summary including failing jobs for a PR.

**Parameters:**
- `pr_number` (number): The PR number
- `owner` (string, optional): Repository owner (auto-detected if not provided)
- `repo` (string, optional): Repository name (auto-detected if not provided)

### `get_failing_jobs`
Get detailed information about failing jobs in a specific CI run.

**Parameters:**
- `run_id` (number): The workflow run ID

### `get_job_logs`
Get and parse logs from a specific job, extracting only test failures.

**Parameters:**
- `job_id` (number): The job ID
- `job_name` (string, optional): The job name (helps with log parsing)

### `extract_linear_tickets`
Extract Linear ticket references from PR content.

**Parameters:**
- `pr_number` (number): The PR number
- `owner` (string, optional): Repository owner (auto-detected if not provided)
- `repo` (string, optional): Repository name (auto-detected if not provided)

### `full_pr_review_context`
Get complete PR review context: details, Linear tickets, and CI status in one call.

**Parameters:**
- `pr_number` (number): The PR number
- `include_logs` (boolean, optional): Whether to include parsed logs from failing jobs (default: false)
- `owner` (string, optional): Repository owner (auto-detected if not provided)
- `repo` (string, optional): Repository name (auto-detected if not provided)

## Log Parsing

The MCP intelligently parses logs from different test frameworks:

### RSpec
Extracts:
- Test description
- File path and line number
- Failure message and error
- Relevant stack trace

### Minitest
Extracts:
- Test name
- File path and line number
- Failure/Error type
- Error message

### Jest
Extracts:
- Test description
- File path and line number
- Error message
- Stack trace excerpt

All logs are compressed to show only failure information, dramatically reducing token usage while maintaining full context.

## Architecture

```
pr-review-helper/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest
├── .mcp.json                # MCP server configuration
├── .gitignore               # Ignore node_modules
├── package.json             # Node.js dependencies
├── index.js                 # MCP server entry point
├── src/
│   ├── git-parser.js        # Auto-detect owner/repo from git remote
│   ├── github-api.js        # GitHub Actions API wrapper
│   ├── log-parser.js        # Test log parsing and compression
│   └── linear-extractor.js  # Linear ticket ID extraction
├── commands/
│   └── review-pr.md         # /review-pr slash command
└── README.md
```

### How It Works

1. **Git Detection**: Automatically parses `git remote get-url origin` to determine owner/repo
2. **GitHub Integration**: Fetches PR data, CI status, and job logs via GitHub API
3. **Log Compression**: Parses test failures and compresses output for token efficiency
4. **Linear Integration**: Extracts ticket IDs and lets Linear MCP fetch full details
5. **Zero Config**: No setup files needed - works immediately in any GitHub repo!

## Token Efficiency

The plugin is designed to be token-efficient:

- **Structured parsing**: Extracts only relevant data from API responses
- **Failure-only logs**: Shows only failing tests, not entire log output
- **Compressed format**: Presents failures in a concise, readable format
- **Parallel job handling**: Aggregates logs from 60+ parallel CI jobs intelligently

## Example Output

```
Linear Tickets Found (1):

- CRM-4929

Note: Use the Linear MCP to fetch full ticket details for these IDs.

RSpec Failures (2):

1. User model validates email format
   File: spec/models/user_spec.rb:45
   Error: Expected true to be false

2. Payment processor handles declined cards
   File: spec/services/payment_processor_spec.rb:102
   Error: RuntimeError: Card declined
```

With Linear MCP installed, Claude will automatically fetch full ticket details including title, description, status, and priority.

## Troubleshooting

### MCP server not starting
- Ensure Node.js 18+ is installed
- Run `npm install` in the plugin directory
- Make sure you're authenticated with `gh auth login`

### Git repository not detected
- Ensure you're in a Git repository with a GitHub remote
- Run `git remote get-url origin` to verify
- Only GitHub repositories are currently supported

### No CI runs found
- Verify the PR has CI checks
- Ensure your GitHub token has repo access via `gh`
- Check that you're in the correct repository directory

### Log parsing issues
- The parser supports RSpec, Minitest, and Jest
- Unknown formats will return raw logs (truncated)
- Check job names match expected patterns

### Linear tickets not showing details
- Install the Linear MCP for full ticket integration
- The plugin extracts ticket IDs - Linear MCP fetches the details

## Future Enhancements

Potential additions:
- Linear API integration for full ticket details
- Coverage report parsing
- Diff analysis for changed files
- Historical PR comparison
- Slack notification integration

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT License - see LICENSE file for details
