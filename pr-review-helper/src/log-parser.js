/**
 * Parse and compress test logs to extract only failure information
 * Supports RSpec, Minitest, and Jest output formats
 */

export class LogParser {
  /**
   * Parse RSpec failure output
   */
  parseRSpecFailures(logs) {
    const failures = [];
    const lines = logs.split('\n');

    let inFailure = false;
    let currentFailure = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect failure start
      if (line.match(/^\s*\d+\)\s+/)) {
        if (currentFailure) {
          failures.push(currentFailure);
        }
        currentFailure = {
          description: line.replace(/^\s*\d+\)\s+/, '').trim(),
          file: null,
          line: null,
          error: [],
          backtrace: []
        };
        inFailure = true;
      }
      // Extract file location
      else if (inFailure && line.match(/^\s+#\s+\.\//)) {
        const match = line.match(/^\s+#\s+\.\/(.+):(\d+)/);
        if (match && currentFailure) {
          currentFailure.file = match[1];
          currentFailure.line = match[2];
        }
      }
      // Extract failure message
      else if (inFailure && line.match(/^\s+Failure\/Error:/)) {
        let j = i + 1;
        while (j < lines.length && !lines[j].match(/^\s*\d+\)\s+|^Finished in/)) {
          if (lines[j].trim()) {
            currentFailure.error.push(lines[j].trim());
          }
          j++;
        }
        i = j - 1;
      }
    }

    if (currentFailure) {
      failures.push(currentFailure);
    }

    return failures;
  }

  /**
   * Parse Minitest failure output
   */
  parseMinitestFailures(logs) {
    const failures = [];
    const lines = logs.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect failure or error
      if (line.match(/^\s*\d+\)\s+(Failure|Error):/)) {
        const failure = {
          type: line.includes('Failure') ? 'Failure' : 'Error',
          test: null,
          file: null,
          line: null,
          error: []
        };

        // Next line usually has the test name
        if (i + 1 < lines.length) {
          failure.test = lines[i + 1].trim();
        }

        // Look for file location
        let j = i + 2;
        while (j < lines.length && !lines[j].match(/^\s*\d+\)/)) {
          const fileLine = lines[j];
          const match = fileLine.match(/\[(.+):(\d+)\]/);
          if (match) {
            failure.file = match[1];
            failure.line = match[2];
          }
          if (fileLine.trim() && !fileLine.match(/^\s*$/)) {
            failure.error.push(fileLine.trim());
          }
          j++;
          if (lines[j]?.match(/^\s*\d+\)/)) break;
        }

        failures.push(failure);
      }
    }

    return failures;
  }

  /**
   * Parse Jest failure output
   */
  parseJestFailures(logs) {
    const failures = [];
    const lines = logs.split('\n');

    let inFailure = false;
    let currentFailure = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect test failure
      if (line.match(/^\s*●/)) {
        if (currentFailure) {
          failures.push(currentFailure);
        }
        currentFailure = {
          description: line.replace(/^\s*●\s*/, '').trim(),
          file: null,
          line: null,
          error: []
        };
        inFailure = true;
      }
      // Extract file location
      else if (inFailure && line.match(/\s+at\s+.*\(.*:\d+:\d+\)/)) {
        const match = line.match(/\((.*):(\d+):\d+\)/);
        if (match && currentFailure && !currentFailure.file) {
          currentFailure.file = match[1];
          currentFailure.line = match[2];
        }
      }
      // Capture error message
      else if (inFailure && line.trim() && !line.match(/^\s*at\s+/)) {
        if (currentFailure && !line.match(/^\s*●/)) {
          currentFailure.error.push(line.trim());
        }
      }
      // End of failure block
      else if (inFailure && line.match(/^\s*$/)) {
        if (currentFailure && currentFailure.error.length > 0) {
          inFailure = false;
        }
      }
    }

    if (currentFailure) {
      failures.push(currentFailure);
    }

    return failures;
  }

  /**
   * Detect test framework and parse accordingly
   */
  parseFailures(logs, framework = 'auto') {
    if (framework === 'auto') {
      // Auto-detect framework
      if (logs.includes('RSpec')) {
        framework = 'rspec';
      } else if (logs.includes('Minitest') || logs.includes('test/')) {
        framework = 'minitest';
      } else if (logs.includes('FAIL') && logs.includes('jest')) {
        framework = 'jest';
      }
    }

    switch (framework) {
      case 'rspec':
        return { framework: 'RSpec', failures: this.parseRSpecFailures(logs) };
      case 'minitest':
        return { framework: 'Minitest', failures: this.parseMinitestFailures(logs) };
      case 'jest':
        return { framework: 'Jest', failures: this.parseJestFailures(logs) };
      default:
        return { framework: 'Unknown', failures: [], raw: logs.substring(0, 2000) };
    }
  }

  /**
   * Compress parsed failures into a token-efficient format
   */
  compressFailures(parsedResult) {
    const { framework, failures } = parsedResult;

    if (failures.length === 0) {
      return `No failures found in ${framework} logs`;
    }

    let compressed = `${framework} Failures (${failures.length}):\n\n`;

    failures.forEach((failure, index) => {
      compressed += `${index + 1}. `;

      if (failure.description) {
        compressed += `${failure.description}\n`;
      } else if (failure.test) {
        compressed += `${failure.test}\n`;
      }

      if (failure.file && failure.line) {
        compressed += `   File: ${failure.file}:${failure.line}\n`;
      }

      if (failure.error && failure.error.length > 0) {
        // Take first few lines of error for context
        const errorLines = failure.error.slice(0, 3);
        compressed += `   Error: ${errorLines.join(' ')}\n`;
      }

      compressed += '\n';
    });

    return compressed;
  }

  /**
   * Process job logs and return compressed failure summary
   */
  processJobLogs(logs, jobName) {
    // Detect framework from job name
    let framework = 'auto';
    if (jobName.toLowerCase().includes('rspec')) {
      framework = 'rspec';
    } else if (jobName.toLowerCase().includes('ruby') || jobName.toLowerCase().includes('minitest')) {
      framework = 'minitest';
    } else if (jobName.toLowerCase().includes('js') || jobName.toLowerCase().includes('jest')) {
      framework = 'jest';
    }

    const parsed = this.parseFailures(logs, framework);
    return this.compressFailures(parsed);
  }
}
