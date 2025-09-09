/**
 * Server-Side Rendering implementation for mermaid diagrams
 * Renders mermaid diagrams to SVG at build time with theme support
 */

/**
 * Server-side mermaid renderer using Node.js environment
 */
class SSRMermaidRenderer {
  constructor(options = {}) {
    this.timeout = options.timeout || 10000;
    this.logger = options.logger;
    this.theme = options.theme || 'default';
    this.mermaidConfig = options.mermaidConfig || {};
    this.mermaidInstance = null;
  }

  /**
   * Initialize mermaid for server-side rendering
   */
  async initMermaid() {
    if (this.mermaidInstance) {
      return this.mermaidInstance;
    }

    try {
      // Set up DOM environment for SSR
      await this.setupDOMEnvironment();
      
      // Try to import mermaid for server-side use
      const mermaidModule = await import('mermaid');
      this.mermaidInstance = mermaidModule.default;
      
      if (this.logger) {
        this.logger.info('Mermaid initialized for SSR with DOM environment');
      }
      
      return this.mermaidInstance;
    } catch (error) {
      if (this.logger) {
        this.logger.warn(`Failed to initialize mermaid for SSR: ${error.message}`);
      }
      throw new Error('Mermaid not available for SSR');
    }
  }

  /**
   * Set up DOM environment for server-side rendering
   */
  async setupDOMEnvironment() {
    // Check if we're already in a DOM environment
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      return; // Already have DOM
    }

    try {
      // Try to import jsdom for server-side DOM simulation
      const { JSDOM } = await import('jsdom');
      
      // Create a minimal DOM environment
      const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
        pretendToBeVisual: true,
        resources: 'usable'
      });
      
      // Set global DOM variables that mermaid expects
      global.window = dom.window;
      global.document = dom.window.document;
      global.navigator = dom.window.navigator;
      global.HTMLElement = dom.window.HTMLElement;
      global.SVGElement = dom.window.SVGElement;
      
      if (this.logger) {
        this.logger.info('DOM environment set up for SSR using JSDOM');
      }
    } catch (error) {
      // JSDOM not available, provide helpful error message
      const errorMessage = error.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes('jsdom')
        ? 'SSR requires jsdom. Install with: npm install jsdom'
        : `JSDOM setup failed: ${error.message}`;
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Render a mermaid diagram to SVG server-side
   * @param {string} diagramContent - The mermaid diagram definition
   * @param {string} [theme] - Theme to use for rendering
   * @returns {Promise<{light: string, dark: string}>} - SVG content for both themes
   */
  async renderDiagram(diagramContent, theme = this.theme) {
    try {
      const mermaid = await this.initMermaid();
      
      // Configure mermaid for SSR
      const baseConfig = {
        startOnLoad: false,
        securityLevel: 'loose',
        theme: theme,
        ...this.mermaidConfig
      };

      // Generate unique IDs
      const lightId = 'mermaid-light-' + Math.random().toString(36).slice(2, 11);
      const darkId = 'mermaid-dark-' + Math.random().toString(36).slice(2, 11);

      let lightSvg, darkSvg;

      try {
        // Render light theme version
        mermaid.initialize({
          ...baseConfig,
          theme: theme === 'dark' ? 'default' : theme
        });

        const lightResult = await mermaid.render(lightId, diagramContent);
        lightSvg = lightResult.svg;

        // Render dark theme version
        mermaid.initialize({
          ...baseConfig,
          theme: 'dark'
        });

        const darkResult = await mermaid.render(darkId, diagramContent);
        darkSvg = darkResult.svg;

        if (this.logger) {
          this.logger.info(`SSR rendered diagram successfully (${lightId})`);
        }

        return {
          light: lightSvg,
          dark: darkSvg
        };
      } catch (renderError) {
        if (this.logger) {
          this.logger.warn(`SSR mermaid render failed: ${renderError.message}`);
        }
        throw renderError;
      }
    } catch (error) {
      if (this.logger) {
        this.logger.error(`SSR mermaid rendering failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Create SSR HTML output with dual-theme support and client-side fallback
   * @param {Object} svgs - Object containing light and dark SVG content
   * @param {string} originalContent - Original mermaid diagram content for fallback
   * @returns {string} - HTML string with SSR output and fallback
   */
  createSSRHTML(svgs, originalContent) {
    return `
<div class="mermaid-ssr-container" data-ssr="true">
  <!-- Light theme SVG (visible by default) -->
  <div class="mermaid-ssr-light" data-theme-variant="light">
    ${svgs.light}
  </div>
  
  <!-- Dark theme SVG (hidden by default) -->  
  <div class="mermaid-ssr-dark" data-theme-variant="dark" style="display: none;">
    ${svgs.dark}
  </div>
  
  <!-- Client-side fallback (hidden when SSR works) -->
  <div class="mermaid-fallback" style="display: none;">
    <pre class="mermaid">${originalContent}</pre>
  </div>
</div>

<script>
(function() {
  const container = document.currentScript.previousElementSibling;
  const lightDiv = container.querySelector('.mermaid-ssr-light');
  const darkDiv = container.querySelector('.mermaid-ssr-dark');
  const fallback = container.querySelector('.mermaid-fallback');
  
  function updateSSRTheme() {
    const htmlTheme = document.documentElement.getAttribute('data-theme');
    const bodyTheme = document.body.getAttribute('data-theme');
    const currentTheme = htmlTheme || bodyTheme;
    
    if (currentTheme === 'dark') {
      lightDiv.style.display = 'none';
      darkDiv.style.display = 'block';
    } else {
      lightDiv.style.display = 'block';
      darkDiv.style.display = 'none';
    }
    
    // Ensure fallback remains hidden since SSR worked
    fallback.style.display = 'none';
  }
  
  // Initialize theme
  updateSSRTheme();
  
  // Watch for theme changes on both html and body
  const observer = new MutationObserver(updateSSRTheme);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['data-theme']
  });
  
  // Handle view transitions
  document.addEventListener('astro:after-swap', updateSSRTheme);
})();
</script>
`;
  }
}

/**
 * Check if a diagram type should be rendered server-side
 * @param {string} diagramContent - The mermaid diagram content
 * @param {Array<string>} ssrDiagrams - Array of diagram types to render server-side
 * @returns {boolean} - Whether this diagram should be rendered server-side
 */
function shouldRenderSSR(diagramContent, ssrDiagrams = []) {
  if (ssrDiagrams.length === 0) {
    // If no specific types specified, render all server-side
    return true;
  }
  
  // Extract diagram type from content
  const diagramType = getDiagramType(diagramContent);
  return ssrDiagrams.includes(diagramType);
}

/**
 * Extract diagram type from mermaid content
 * @param {string} content - Mermaid diagram content
 * @returns {string} - Diagram type
 */
function getDiagramType(content) {
  const trimmed = content.trim().toLowerCase();
  
  // Flowcharts can start with 'graph', 'flowchart', or 'gitgraph'
  if (trimmed.startsWith('graph ') || trimmed.startsWith('flowchart ')) return 'flowchart';
  if (trimmed.startsWith('gitgraph')) return 'git';
  
  // Sequence diagrams
  if (trimmed.startsWith('sequencediagram') || trimmed.includes('participant')) return 'sequence';
  
  // Class diagrams
  if (trimmed.startsWith('classdiagram')) return 'class';
  
  // State diagrams
  if (trimmed.startsWith('statediagram')) return 'state';
  
  // Other diagram types
  if (trimmed.startsWith('gantt')) return 'gantt';
  if (trimmed.startsWith('erdiagram')) return 'er';
  if (trimmed.startsWith('journey')) return 'journey';
  if (trimmed.startsWith('pie')) return 'pie';
  if (trimmed.startsWith('requirement')) return 'requirement';
  if (trimmed.startsWith('c4context') || trimmed.startsWith('c4container')) return 'c4';
  if (trimmed.startsWith('mindmap')) return 'mindmap';
  if (trimmed.startsWith('timeline')) return 'timeline';
  if (trimmed.startsWith('quadrantchart')) return 'quadrant';
  if (trimmed.startsWith('architecture-beta')) return 'architecture';
  if (trimmed.startsWith('block-beta')) return 'block';
  if (trimmed.startsWith('xychart-beta')) return 'xychart';
  if (trimmed.startsWith('sankey-beta')) return 'sankey';
  if (trimmed.startsWith('packet-beta')) return 'packet';
  
  return 'unknown';
}

/**
 * Remark plugin for server-side mermaid rendering
 * @param {Object} options - Configuration options
 * @returns {Function} - Remark transformer function
 */
export function remarkMermaidPluginSSR(options = {}) {
  return async function transformer(tree, file) {
    const { visit } = await import('unist-util-visit');
    
    let mermaidCount = 0;
    const renderer = new SSRMermaidRenderer(options);
    
    // Process nodes sequentially to avoid overwhelming the renderer
    const mermaidNodes = [];
    
    visit(tree, 'code', (node, index, parent) => {
      if (node.lang === 'mermaid') {
        mermaidNodes.push({ node, index, parent });
      }
    });
    
    // Process each mermaid node
    for (const { node, index, parent } of mermaidNodes) {
      mermaidCount++;
      
      try {
        // Check if this diagram should be rendered server-side
        if (!shouldRenderSSR(node.value, options.ssrDiagrams)) {
          // Fall back to client-side rendering
          parent.children[index] = {
            type: 'html',
            value: `<pre class="mermaid">${node.value}</pre>`
          };
          
          if (options.logger) {
            options.logger.info(`SSR skipped for diagram type, using client-side for block #${mermaidCount}`);
          }
          continue;
        }
        
        // Render server-side with timeout
        const renderPromise = renderer.renderDiagram(node.value);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('SSR timeout')), renderer.timeout);
        });
        
        const svgs = await Promise.race([renderPromise, timeoutPromise]);
        const ssrHTML = renderer.createSSRHTML(svgs, node.value);
        
        // Replace with SSR output
        parent.children[index] = {
          type: 'html',
          value: ssrHTML
        };
        
        if (options.logger) {
          options.logger.info(`SSR transformed mermaid block #${mermaidCount} in ${file.path || 'unknown file'}`);
        }
        
      } catch (error) {
        // Graceful fallback to client-side rendering
        parent.children[index] = {
          type: 'html',
          value: `<pre class="mermaid">${node.value}</pre>`
        };
        
        if (options.logger) {
          options.logger.warn(`SSR failed for block #${mermaidCount}, falling back to client-side: ${error.message}`);
        }
      }
    }
    
    if (mermaidCount > 0 && options.logger) {
      options.logger.info(`SSR processed ${mermaidCount} mermaid blocks total`);
    }
  };
}