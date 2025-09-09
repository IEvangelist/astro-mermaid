/**
 * Tests for client-side functionality (regression tests)
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { remarkMermaidPlugin, generateClientScript, generateMermaidCSS } from '../src/client-side.js';

describe('Client-side Plugin', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should transform mermaid code blocks to pre.mermaid', async () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'code',
          lang: 'mermaid',
          value: 'graph TD\n    A[Start] --> B[End]'
        },
        {
          type: 'code',
          lang: 'javascript',
          value: 'console.log("test")'
        }
      ]
    };

    const plugin = remarkMermaidPlugin({ logger: mockLogger });
    await plugin(tree, { path: 'test.md' });

    expect(tree.children[0]).toEqual({
      type: 'html',
      value: '<pre class="mermaid">graph TD\n    A[Start] --> B[End]</pre>'
    });

    // Non-mermaid code blocks should remain unchanged
    expect(tree.children[1]).toEqual({
      type: 'code',
      lang: 'javascript',
      value: 'console.log("test")'
    });

    expect(mockLogger.info).toHaveBeenCalledWith('Remark transformed mermaid block #1 in test.md');
    expect(mockLogger.info).toHaveBeenCalledWith('Remark total mermaid blocks transformed: 1');
  });

  test('should handle multiple mermaid blocks', async () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'code',
          lang: 'mermaid',
          value: 'graph TD\n    A --> B'
        },
        {
          type: 'code',
          lang: 'mermaid',
          value: 'sequenceDiagram\n    A->>B: Hello'
        }
      ]
    };

    const plugin = remarkMermaidPlugin({ logger: mockLogger });
    await plugin(tree, { path: 'test.md' });

    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].type).toBe('html');
    expect(tree.children[1].type).toBe('html');
    expect(mockLogger.info).toHaveBeenCalledWith('Remark total mermaid blocks transformed: 2');
  });

  test('should preserve diagram content correctly', async () => {
    const diagramContent = 'graph TD\n    A[Start] --> B{Decision}\n    B -->|Yes| C[Success]';
    const tree = {
      type: 'root',
      children: [
        {
          type: 'code',
          lang: 'mermaid',
          value: diagramContent
        }
      ]
    };

    const plugin = remarkMermaidPlugin();
    await plugin(tree, {});

    expect(tree.children[0].value).toBe(`<pre class="mermaid">${diagramContent}</pre>`);
  });

  test('should work without logger', async () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'code',
          lang: 'mermaid',
          value: 'graph TD\n    A --> B'
        }
      ]
    };

    const plugin = remarkMermaidPlugin();
    await plugin(tree, {});

    expect(tree.children[0].type).toBe('html');
  });
});

describe('Client Script Generation', () => {
  test('should generate script with default options', () => {
    const script = generateClientScript();
    
    expect(script).toContain('hasMermaidDiagrams()');
    expect(script).toContain('import(\'mermaid\')');
    expect(script).toContain('astro:after-swap');
    expect(script).toContain('"startOnLoad":false');
  });

  test('should include theme configuration', () => {
    const script = generateClientScript({
      theme: 'forest',
      autoTheme: true,
      mermaidConfig: { curve: 'basis' }
    });
    
    expect(script).toContain('"theme":"forest"');
    expect(script).toContain('"curve":"basis"');
    expect(script).toContain('if (true)'); // autoTheme becomes true in the script
  });

  test('should serialize icon packs correctly', () => {
    const iconPacks = [
      {
        name: 'test-pack',
        loader: () => Promise.resolve({ icons: {} })
      }
    ];
    
    const script = generateClientScript({ iconPacks });
    
    expect(script).toContain('"name":"test-pack"');
    expect(script).toContain('registerIconPacks');
  });
});

describe('CSS Generation', () => {
  test('should generate mermaid CSS', () => {
    const css = generateMermaidCSS();
    
    expect(css).toContain('pre.mermaid');
    expect(css).toContain('shimmer');
    expect(css).toContain('[data-processed]');
    expect(css).toContain('data-theme="dark"');
    expect(css).toContain('max-width: 100%');
  });
});