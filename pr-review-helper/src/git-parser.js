import { execSync } from 'child_process';

/**
 * Parse Git remote to extract owner and repository name
 */
export class GitParser {
  /**
   * Get the current working directory from environment
   * Claude Code sets this when running MCP servers
   */
  static getCurrentRepo() {
    const baseCwd = process.env.PWD || process.cwd();

    try {
      const remoteUrl = execSync('git remote get-url origin', {
        encoding: 'utf-8',
        cwd: baseCwd
      }).trim();
      return this.parseGitUrl(remoteUrl);
    } catch (error) {
      throw new Error(
        `Could not detect Git repository from ${baseCwd}. Make sure you are in a Git repository with a remote origin, or pass owner/repo parameters explicitly.`
      );
    }
  }

  /**
   * Parse a Git URL to extract owner and repo
   * Supports:
   * - SSH: git@github.com:owner/repo.git
   * - HTTPS: https://github.com/owner/repo.git
   * - HTTPS with auth: https://user@github.com/owner/repo.git
   */
  static parseGitUrl(url) {
    // SSH format: git@github.com:owner/repo.git
    let match = url.match(/git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
    if (match) {
      return {
        owner: match[1],
        repo: match[2]
      };
    }

    // HTTPS format: https://github.com/owner/repo.git
    match = url.match(/https:\/\/(?:[^@]+@)?github\.com\/([^/]+)\/(.+?)(?:\.git)?$/);
    if (match) {
      return {
        owner: match[1],
        repo: match[2]
      };
    }

    throw new Error(
      `Could not parse Git URL: ${url}. Only GitHub repositories are supported.`
    );
  }

  /**
   * Get repo info with validation
   */
  static getRepoInfo() {
    const { owner, repo } = this.getCurrentRepo();

    if (!owner || !repo) {
      throw new Error('Could not determine repository owner and name');
    }

    return { owner, repo };
  }
}
