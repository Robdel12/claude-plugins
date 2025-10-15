/**
 * Extract Linear ticket references from PR content
 * Supports common patterns: CRM-XXXX, GQ-XXXX, etc.
 *
 * Returns just the ticket IDs - Claude Code can use the Linear MCP
 * to fetch full ticket details.
 */

export class LinearExtractor {
  /**
   * Extract Linear ticket IDs from text
   * Common patterns: CRM-3628, GQ-1234, etc.
   */
  extractTickets(text) {
    if (!text) {
      return [];
    }

    // Pattern: PROJECT-NUMBER (e.g., CRM-3628, GQ-1234)
    const pattern = /\b([A-Z]{2,10}-\d+)\b/g;
    const matches = text.match(pattern);

    if (!matches) {
      return [];
    }

    // Deduplicate
    return [...new Set(matches)];
  }

  /**
   * Extract tickets from PR details
   */
  extractFromPR(prDetails) {
    const tickets = new Set();

    // Check PR body
    if (prDetails.pr.body) {
      this.extractTickets(prDetails.pr.body).forEach(t => tickets.add(t));
    }

    // Check commit messages
    if (prDetails.commits) {
      prDetails.commits.forEach(commit => {
        this.extractTickets(commit.message).forEach(t => tickets.add(t));
      });
    }

    // Check comments
    if (prDetails.comments) {
      prDetails.comments.forEach(comment => {
        this.extractTickets(comment.body).forEach(t => tickets.add(t));
      });
    }

    return Array.from(tickets);
  }

  /**
   * Get a list of Linear ticket IDs from PR
   * Returns array of ticket IDs that can be queried via Linear MCP
   */
  getTicketIds(prDetails) {
    return this.extractFromPR(prDetails);
  }

  /**
   * Get a formatted summary of Linear tickets found
   * Just lists the IDs - Claude Code will use Linear MCP for full details
   */
  getSummary(prDetails) {
    const tickets = this.extractFromPR(prDetails);

    if (tickets.length === 0) {
      return 'No Linear tickets found in PR';
    }

    let summary = `Linear Tickets Found (${tickets.length}):\n\n`;
    tickets.forEach(ticket => {
      summary += `- ${ticket}\n`;
    });
    summary += '\nNote: Use the Linear MCP to fetch full ticket details for these IDs.';

    return summary;
  }
}
