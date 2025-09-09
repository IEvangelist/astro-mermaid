import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createMermaidRemarkPlugin, rehypeMermaidPlugin, generateClientScript, generateMermaidCSS } from './src/factory.js';

/**
 * Astro integration for rendering Mermaid diagrams
 * Supports both client-side and server-side rendering with automatic theme switching
 * 
 * @param {Object} options - Configuration options
 * @param {string} [options.theme='default'] - Default theme ('default', 'dark', 'forest', 'neutral')
 * @param {boolean} [options.autoTheme=true] - Enable automatic theme switching based on data-theme attribute
 * @param {boolean} [options.ssr=false] - Enable server-side rendering
 * @param {Array<string>} [options.ssrDiagrams] - Limit SSR to specific diagram types
 * @param {number} [options.timeout=10000] - SSR rendering timeout in milliseconds
 * @param {Object} [options.mermaidConfig={}] - Additional mermaid configuration options
 * @param {Array} [options.iconPacks=[]] - Icon packs for architecture diagrams
 * @returns {import('astro').AstroIntegration}
 */
export default function astroMermaid(options = {}) {
  const {
    theme = 'default',
    autoTheme = true,
    ssr = false,
    ssrDiagrams = [],
    timeout = 10000,
    mermaidConfig = {},
    iconPacks = []
  } = options;

  return {
    name: 'astro-mermaid',
    hooks: {
      'astro:config:setup': async ({ config, updateConfig, addWatchFile, injectScript, logger, command }) => {
        logger.info('Setting up Mermaid integration');

        // Log existing rehype plugins
        logger.info('Existing rehype plugins:', config.markdown?.rehypePlugins?.length || 0);

        // Update markdown config to use factory pattern for plugin selection
        updateConfig({
          markdown: {
            remarkPlugins: [
              ...(config.markdown?.remarkPlugins || []),
              [createMermaidRemarkPlugin, { 
                logger, 
                ssr, 
                ssrDiagrams, 
                timeout, 
                theme, 
                mermaidConfig 
              }]
            ],
            rehypePlugins: [
              ...(config.markdown?.rehypePlugins || []),
              [rehypeMermaidPlugin, { logger }]
            ]
          },
          vite: {
            optimizeDeps: {
              include: ['mermaid']
            }
          }
        });

        // Serialize icon packs for client-side use
        const iconPacksConfig = iconPacks.map(pack => ({
          name: pack.name,
          loader: pack.loader.toString()
        }));

        // Inject client-side mermaid script with conditional loading
        const mermaidScriptContent = generateClientScript({
          theme,
          autoTheme,
          mermaidConfig,
          iconPacks
        });

        injectScript('page', mermaidScriptContent);

        // Add CSS to the page with layout shift prevention
        const cssContent = generateMermaidCSS();
        injectScript('page', cssContent);
      }
    }
  };
}