import { Octokit } from '@octokit/rest';
import fetch from 'node-fetch';
import { GitParser } from './git-parser.js';

export class GitHubAPI {
  constructor(token) {
    this.octokit = new Octokit({ auth: token });
    this.token = token;
  }

  /**
   * Get repo info - either from parameters or auto-detect from git remote
   */
  _getRepoInfo(owner, repo) {
    if (owner && repo) {
      return { owner, repo };
    }
    return GitParser.getRepoInfo();
  }

  /**
   * Get comprehensive PR details including description, comments, and reviews
   */
  async getPRDetails(prNumber, owner, repo) {
    const { owner: repoOwner, repo: repoName } = this._getRepoInfo(owner, repo);

    try {
      const [pr, comments, reviewComments, reviews, commits] = await Promise.all([
        this.octokit.pulls.get({ owner: repoOwner, repo: repoName, pull_number: prNumber }),
        this.octokit.issues.listComments({ owner: repoOwner, repo: repoName, issue_number: prNumber }),
        this.octokit.pulls.listReviewComments({ owner: repoOwner, repo: repoName, pull_number: prNumber }),
        this.octokit.pulls.listReviews({ owner: repoOwner, repo: repoName, pull_number: prNumber }),
        this.octokit.pulls.listCommits({ owner: repoOwner, repo: repoName, pull_number: prNumber })
      ]);

      return {
        pr: {
          number: pr.data.number,
          title: pr.data.title,
          body: pr.data.body,
          state: pr.data.state,
          draft: pr.data.draft,
          head: pr.data.head.ref,
          base: pr.data.base.ref,
          user: pr.data.user.login,
          created_at: pr.data.created_at,
          updated_at: pr.data.updated_at,
          mergeable_state: pr.data.mergeable_state,
          html_url: pr.data.html_url
        },
        comments: comments.data.map(c => ({
          user: c.user.login,
          body: c.body,
          created_at: c.created_at
        })),
        reviewComments: reviewComments.data.map(c => ({
          user: c.user.login,
          body: c.body,
          path: c.path,
          line: c.line,
          created_at: c.created_at
        })),
        reviews: reviews.data.map(r => ({
          user: r.user.login,
          state: r.state,
          body: r.body,
          submitted_at: r.submitted_at
        })),
        commits: commits.data.map(c => ({
          sha: c.sha.substring(0, 7),
          message: c.commit.message,
          author: c.commit.author.name
        }))
      };
    } catch (error) {
      throw new Error(`Failed to fetch PR details: ${error.message}`);
    }
  }

  /**
   * Get the latest CI workflow runs for a PR
   */
  async getCIRuns(prNumber, owner, repo) {
    const { owner: repoOwner, repo: repoName } = this._getRepoInfo(owner, repo);

    try {
      const pr = await this.octokit.pulls.get({ owner: repoOwner, repo: repoName, pull_number: prNumber });
      const headSha = pr.data.head.sha;

      // Get workflow runs for the head commit
      const runs = await this.octokit.actions.listWorkflowRunsForRepo({
        owner: repoOwner,
        repo: repoName,
        head_sha: headSha,
        per_page: 10
      });

      return runs.data.workflow_runs.map(run => ({
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: run.conclusion,
        html_url: run.html_url,
        created_at: run.created_at,
        updated_at: run.updated_at
      }));
    } catch (error) {
      throw new Error(`Failed to fetch CI runs: ${error.message}`);
    }
  }

  /**
   * Get failing jobs from a specific workflow run
   */
  async getFailingJobs(runId, owner, repo) {
    const { owner: repoOwner, repo: repoName } = this._getRepoInfo(owner, repo);

    try {
      const jobs = await this.octokit.actions.listJobsForWorkflowRun({
        owner: repoOwner,
        repo: repoName,
        run_id: runId,
        filter: 'latest'
      });

      const failedJobs = jobs.data.jobs.filter(job =>
        job.conclusion === 'failure' || job.conclusion === 'cancelled'
      );

      return failedJobs.map(job => ({
        id: job.id,
        name: job.name,
        status: job.status,
        conclusion: job.conclusion,
        started_at: job.started_at,
        completed_at: job.completed_at,
        html_url: job.html_url,
        steps: job.steps.filter(step => step.conclusion === 'failure').map(step => ({
          name: step.name,
          conclusion: step.conclusion,
          number: step.number
        }))
      }));
    } catch (error) {
      throw new Error(`Failed to fetch failing jobs: ${error.message}`);
    }
  }

  /**
   * Download and extract test logs from workflow run artifacts
   */
  async getTestLogs(runId) {
    try {
      // List artifacts for the run
      const artifacts = await this.octokit.actions.listWorkflowRunArtifacts({
        owner: this.owner,
        repo: this.repo,
        run_id: runId
      });

      // Filter for log artifacts
      const logArtifacts = artifacts.data.artifacts.filter(artifact =>
        artifact.name.startsWith('logs-') || artifact.name.includes('test.log')
      );

      if (logArtifacts.length === 0) {
        return { message: 'No test log artifacts found for this run' };
      }

      // Return artifact info (actual download would require zip extraction)
      return {
        availableArtifacts: logArtifacts.map(artifact => ({
          id: artifact.id,
          name: artifact.name,
          size_in_bytes: artifact.size_in_bytes,
          expired: artifact.expired,
          created_at: artifact.created_at,
          download_url: `https://api.github.com/repos/${this.owner}/${this.repo}/actions/artifacts/${artifact.id}/zip`
        }))
      };
    } catch (error) {
      throw new Error(`Failed to fetch test logs: ${error.message}`);
    }
  }

  /**
   * Get job logs directly from GitHub Actions API
   */
  async getJobLogs(jobId, owner, repo) {
    const { owner: repoOwner, repo: repoName } = this._getRepoInfo(owner, repo);

    try {
      const response = await fetch(
        `https://api.github.com/repos/${repoOwner}/${repoName}/actions/jobs/${jobId}/logs`,
        {
          headers: {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
      }

      const logs = await response.text();
      return logs;
    } catch (error) {
      throw new Error(`Failed to fetch job logs: ${error.message}`);
    }
  }

  /**
   * Get comprehensive CI summary for a PR
   */
  async getCISummary(prNumber, owner, repo) {
    try {
      const runs = await this.getCIRuns(prNumber, owner, repo);

      if (runs.length === 0) {
        return { message: 'No CI runs found for this PR' };
      }

      // Find the Tests workflow (most important for PR reviews)
      const testsRun = runs.find(run => run.name === 'Tests') || runs[0];

      let failedJobs = [];
      if (testsRun.conclusion === 'failure' || testsRun.conclusion === 'cancelled') {
        failedJobs = await this.getFailingJobs(testsRun.id, owner, repo);
      }

      return {
        testsRun: {
          ...testsRun,
          failedJobCount: failedJobs.length
        },
        failedJobs,
        allRuns: runs
      };
    } catch (error) {
      throw new Error(`Failed to get CI summary: ${error.message}`);
    }
  }
}
