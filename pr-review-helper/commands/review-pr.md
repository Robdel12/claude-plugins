---
description: Review a PR with CI logs and Linear context
---

# PR Review Helper

Review PR {{arg1}} for the current repository.

**Step 1: Fetch PR Context**
Use the `full_pr_review_context` MCP tool from pr-review-helper server:
- pr_number: {{arg1}}
- include_logs: true

**Step 2: Fetch Linear Ticket Details**
If Linear tickets were found (e.g., CRM-4929), use the Linear MCP to get full details:
- For each ticket ID, use the Linear MCP `getIssue` tool
- Include ticket title, description, status, and priority in your analysis

**Step 3: Present Comprehensive Analysis**
Structure the information as follows:

## PR Overview
- Title and description
- Author and status
- Branch information
- Key changes and purpose

## Linear Context
- List any Linear tickets found
- Provide clickable links to tickets
- Note if no tickets are referenced

## CI Status
- Overall CI status (passing/failing)
- List of failing jobs (if any)
- Summary of test failures by type (RSpec/Minitest/Jest)

## Test Failures (if any)
For each failing test:
- Test name and location
- Error message
- File path and line number
- Relevant stack trace excerpt

## Review Comments & Discussions
- Summarize existing review comments
- Note any unresolved conversations
- Highlight concerns or questions from reviewers

## Recommendations
Based on the PR context and failures, provide:
- Assessment of the changes
- Potential risks or concerns
- Suggestions for improvements
- Next steps for the PR author

Keep your analysis concise and actionable. Focus on what's most important for the reviewer to know.
