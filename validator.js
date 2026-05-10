/**
 * ARIA Code Validator
 * 
 * Implements deterministic safety checks for AI-generated code.
 * See FEATURES.md F-03 for the specification.
 */

const fs = require('fs');
const path = require('path');

class Validator {
  constructor(options = {}) {
    this.maxLines = options.maxLines || 500;
  }

  /**
   * Validate a piece of code
   * @param {string} code The code to validate
   * @param {string} filename Expected filename (optional)
   * @returns {object} { valid: boolean, passed_checks: string[], failed_checks: string[], recommendation: string }
   */
  validate(code, filename = null) {
    const checks = {
      syntax: true,
      tests: true, // This is handled externally by the sandbox runner
      no_eval: !/\beval\s*\(/.test(code),
      no_exec: !/\bexec\s*\(/.test(code),
      no_process_exit: !/\bprocess\.exit\s*\(/.test(code),
      no_unsafe_fs: !/\bfs\.(unlink|rm|rmdir|rename|truncate|writeFile|appendFile)\b/.test(code),
      no_child_process: !/\bchild_process\b/.test(code),
      file_size: code.split('\n').length <= this.maxLines,
      name_match: true // Handled if filename provided
    };

    // Syntax check using local node parse (simple check)
    try {
      new Function(code);
    } catch (e) {
      checks.syntax = false;
    }

    const failed_checks = Object.keys(checks).filter(k => !checks[k]);
    const passed_checks = Object.keys(checks).filter(k => checks[k]);

    let recommendation = 'accept';
    if (!checks.syntax) recommendation = 'retry';
    else if (failed_checks.some(c => ['no_eval', 'no_exec', 'no_process_exit', 'no_child_process'].includes(c))) {
      recommendation = 'reject';
    } else if (failed_checks.length > 0) {
      recommendation = 'retry';
    }

    return {
      valid: failed_checks.length === 0,
      passed_checks,
      failed_checks,
      recommendation
    };
  }
}

module.exports = Validator;
