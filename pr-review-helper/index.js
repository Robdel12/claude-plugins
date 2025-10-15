#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { execSync } from 'child_process';
import { GitHubAPI } from './src/github-api.js';
import { LogParser } from './src/log-parser.js';
import { LinearExtractor } from './src/linear-extractor.js';

// Try to get GitHub token from environment, or fetch from gh CLI
let GITHUB_TOKEN = process.env.GITHUB_TOKEN;

if (!GITHUB_TOKEN) {
  try {
    GITHUB_TOKEN = execSync('gh auth token', { encoding: 'utf-8' }).trim();
    console.error('✓ Retrieved GitHub token from gh CLI');
  } catch (error) {
    console.error('Error: Could not get GitHub token');
    console.error('Either set GITHUB_TOKEN env var or authenticate with: gh auth login');
    process.exit(1);
  }
}

// Initialize services
const githubAPI = new GitHubAPI(GITHUB_TOKEN);
const logParser = new LogParser();
const linearExtractor = new LinearExtractor();

// Create MCP server
const server = new Server(
  {
    name: 'pr-review-helper',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_pr_details',
        description: 'Get comprehensive PR details including description, comments, reviews, and commits. Auto-detects repo from git remote if owner/repo not provided.',
        inputSchema: {
          type: 'object',
          properties: {
            owner: {
              type: 'string',
              description: 'Repository owner (auto-detected if not provided)',
            },
            repo: {
              type: 'string',
              description: 'Repository name (auto-detected if not provided)',
            },
            pr_number: {
              type: 'number',
              description: 'The PR number to fetch details for',
            },
          },
          required: ['pr_number'],
        },
      },
      {
        name: 'get_ci_summary',
        description: 'Get CI status summary including failing jobs for a PR',
        inputSchema: {
          type: 'object',
          properties: {
            pr_number: {
              type: 'number',
              description: 'The PR number to check CI status for',
            },
          },
          required: ['pr_number'],
        },
      },
      {
        name: 'get_failing_jobs',
        description: 'Get detailed information about failing jobs in a specific CI run',
        inputSchema: {
          type: 'object',
          properties: {
            run_id: {
              type: 'number',
              description: 'The workflow run ID',
            },
          },
          required: ['run_id'],
        },
      },
      {
        name: 'get_job_logs',
        description: 'Get and parse logs from a specific job, extracting only test failures',
        inputSchema: {
          type: 'object',
          properties: {
            job_id: {
              type: 'number',
              description: 'The job ID to fetch logs for',
            },
            job_name: {
              type: 'string',
              description: 'The job name (helps with log parsing)',
            },
          },
          required: ['job_id'],
        },
      },
      {
        name: 'extract_linear_tickets',
        description: 'Extract Linear ticket references from PR content',
        inputSchema: {
          type: 'object',
          properties: {
            pr_number: {
              type: 'number',
              description: 'The PR number to extract tickets from',
            },
          },
          required: ['pr_number'],
        },
      },
      {
        name: 'full_pr_review_context',
        description: 'Get complete PR review context: details, Linear tickets, and CI status in one call',
        inputSchema: {
          type: 'object',
          properties: {
            pr_number: {
              type: 'number',
              description: 'The PR number to get full context for',
            },
            include_logs: {
              type: 'boolean',
              description: 'Whether to include parsed logs from failing jobs (default: false)',
              default: false,
            },
          },
          required: ['pr_number'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'get_pr_details': {
        const prDetails = await githubAPI.getPRDetails(args.pr_number, args.owner, args.repo);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(prDetails, null, 2),
            },
          ],
        };
      }

      case 'get_ci_summary': {
        const ciSummary = await githubAPI.getCISummary(args.pr_number, args.owner, args.repo);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(ciSummary, null, 2),
            },
          ],
        };
      }

      case 'get_failing_jobs': {
        const failingJobs = await githubAPI.getFailingJobs(args.run_id);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(failingJobs, null, 2),
            },
          ],
        };
      }

      case 'get_job_logs': {
        const rawLogs = await githubAPI.getJobLogs(args.job_id, args.owner, args.repo);
        const jobName = args.job_name || 'unknown';
        const compressedLogs = logParser.processJobLogs(rawLogs, jobName);

        return {
          content: [
            {
              type: 'text',
              text: compressedLogs,
            },
          ],
        };
      }

      case 'extract_linear_tickets': {
        const prDetails = await githubAPI.getPRDetails(args.pr_number, args.owner, args.repo);
        const summary = linearExtractor.getSummary(prDetails);

        return {
          content: [
            {
              type: 'text',
              text: summary,
            },
          ],
        };
      }

      case 'full_pr_review_context': {
        // Fetch all data in parallel
        const [prDetails, ciSummary] = await Promise.all([
          githubAPI.getPRDetails(args.pr_number, args.owner, args.repo),
          githubAPI.getCISummary(args.pr_number, args.owner, args.repo),
        ]);

        const linearSummary = linearExtractor.getSummary(prDetails);

        let result = {
          ...prDetails,  // Spread PR details (pr, comments, reviews, commits)
          linear_tickets: linearSummary,
          ci: ciSummary,
        };

        // Optionally include parsed logs from failing jobs
        if (args.include_logs && ciSummary.failedJobs && ciSummary.failedJobs.length > 0) {
          const logPromises = ciSummary.failedJobs.slice(0, 5).map(async (job) => {
            try {
              const rawLogs = await githubAPI.getJobLogs(job.id, args.owner, args.repo);
              const compressedLogs = logParser.processJobLogs(rawLogs, job.name);
              return {
                job_name: job.name,
                job_id: job.id,
                logs: compressedLogs,
              };
            } catch (error) {
              return {
                job_name: job.name,
                job_id: job.id,
                error: error.message,
              };
            }
          });

          result.failing_job_logs = await Promise.all(logPromises);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('PR Review Helper MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
