/**
 * Factory pattern for selecting appropriate mermaid plugin
 * Chooses between client-side and SSR implementations based on configuration
 */

import { remarkMermaidPlugin as remarkMermaidClientPlugin, rehypeMermaidPlugin } from './client-side.js';
import { remarkMermaidPluginSSR } from './ssr.js';

/**
 * Factory function to create the appropriate mermaid remark plugin
 * @param {Object} options - Configuration options
 * @param {boolean} [options.ssr=false] - Enable server-side rendering
 * @param {Array<string>} [options.ssrDiagrams] - Limit SSR to specific diagram types
 * @param {number} [options.timeout=10000] - SSR rendering timeout in milliseconds
 * @param {Object} [options.logger] - Logger instance
 * @returns {Function} The appropriate remark plugin
 */
export function createMermaidRemarkPlugin(options = {}) {
  const { ssr = false, logger } = options;
  
  if (ssr) {
    if (logger) {
      logger.info('Using SSR mermaid plugin');
    }
    return remarkMermaidPluginSSR(options);
  }
  
  if (logger) {
    logger.info('Using client-side mermaid plugin (default)');
  }
  return remarkMermaidClientPlugin(options);
}

/**
 * Export the rehype plugin (unchanged, used as fallback in both modes)
 */
export { rehypeMermaidPlugin };

/**
 * Export client-side functions for use in both modes
 */
export { generateClientScript, generateMermaidCSS } from './client-side.js';