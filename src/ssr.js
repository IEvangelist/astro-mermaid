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
  }

  /**
   * Render a mermaid diagram to SVG server-side
   * @param {string} diagramContent - The mermaid diagram definition
   * @param {string} [theme] - Theme to use for rendering
   * @returns {Promise<{light: string, dark: string}>} - SVG content for both themes
   */
  async renderDiagram(diagramContent, theme = this.theme) {
    try {
      // Import mermaid dynamically (only available in Node.js during build)
      const { default: mermaid } = await import('mermaid');
      
      // Configure mermaid for SSR
      const baseConfig = {
        startOnLoad: false,
        securityLevel: 'loose',
        ...this.mermaidConfig
      };

      // Render light theme version
      mermaid.initialize({
        ...baseConfig,
        theme: theme === 'dark' ? 'default' : theme
      });

      const lightId = 'mermaid-light-' + Math.random().toString(36).slice(2, 11);
      const { svg: lightSvg } = await mermaid.render(lightId, diagramContent);

      // Render dark theme version
      mermaid.initialize({
        ...baseConfig,
        theme: 'dark'
      });

      const darkId = 'mermaid-dark-' + Math.random().toString(36).slice(2, 11);
      const { svg: darkSvg } = await mermaid.render(darkId, diagramContent);

      return {
        light: lightSvg,
        dark: darkSvg
      };
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
<div class="mermaid-ssr-container">
  <!-- Light theme SVG -->
  <div class="mermaid-ssr-light" data-theme="light" style="display: none;">
    ${svgs.light}
  </div>
  
  <!-- Dark theme SVG -->  
  <div class="mermaid-ssr-dark" data-theme="dark" style="display: none;">
    ${svgs.dark}
  </div>
  
  <!-- Client-side fallback (hidden when SSR works) -->
  <div class="mermaid-fallback" style="display: none;">
    <pre class="mermaid">${originalContent}</pre>
  </div>
  
  <!-- SSR Theme switching script -->
  <script>
    (function() {
      const container = document.currentScript.parentElement;
      const lightDiv = container.querySelector('.mermaid-ssr-light');
      const darkDiv = container.querySelector('.mermaid-ssr-dark');
      const fallback = container.querySelector('.mermaid-fallback');
      
      function updateTheme() {
        const htmlTheme = document.documentElement.getAttribute('data-theme');
        const bodyTheme = document.body.getAttribute('data-theme');
        const currentTheme = htmlTheme || bodyTheme || 'light';
        
        if (currentTheme === 'dark') {
          lightDiv.style.display = 'none';
          darkDiv.style.display = 'block';
        } else {
          lightDiv.style.display = 'block';
          darkDiv.style.display = 'none';
        }
        
        // Hide fallback since SSR worked
        fallback.style.display = 'none';
      }
      
      // Initialize theme
      updateTheme();
      
      // Watch for theme changes
      const observer = new MutationObserver(updateTheme);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
      });
      observer.observe(document.body, {
        attributes: true,
        attributeFilter: ['data-theme']
      });
    })();
  </script>
</div>
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
  
  if (trimmed.startsWith('graph') || trimmed.startsWith('flowchart')) return 'flowchart';
  if (trimmed.startsWith('sequencediagram') || trimmed.includes('participant')) return 'sequence';
  if (trimmed.startsWith('gantt')) return 'gantt';
  if (trimmed.startsWith('classDiagram')) return 'class';
  if (trimmed.startsWith('stateDiagram')) return 'state';
  if (trimmed.startsWith('erDiagram')) return 'er';
  if (trimmed.startsWith('journey')) return 'journey';
  if (trimmed.startsWith('gitGraph')) return 'git';
  if (trimmed.startsWith('pie')) return 'pie';
  if (trimmed.startsWith('requirement')) return 'requirement';
  if (trimmed.startsWith('c4Context') || trimmed.startsWith('c4Container')) return 'c4';
  if (trimmed.startsWith('mindmap')) return 'mindmap';
  if (trimmed.startsWith('timeline')) return 'timeline';
  if (trimmed.startsWith('quadrantChart')) return 'quadrant';
  if (trimmed.startsWith('architecture-beta')) return 'architecture';
  
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