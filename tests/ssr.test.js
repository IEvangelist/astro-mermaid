/**
 * Tests for SSR functionality
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { remarkMermaidPluginSSR } from '../src/ssr.js';

describe('SSR Plugin', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should fallback to client-side when SSR fails', async () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'code',
          lang: 'mermaid',
          value: 'graph TD\n    A[Start] --> B[End]'
        }
      ]
    };

    const plugin = remarkMermaidPluginSSR({ 
      logger: mockLogger,
      timeout: 100 // Short timeout to force failure
    });
    
    await plugin(tree, { path: 'test.md' });

    // Should fallback to client-side pre.mermaid
    expect(tree.children[0]).toEqual({
      type: 'html',
      value: '<pre class="mermaid">graph TD\n    A[Start] --> B[End]</pre>'
    });

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('SSR failed for block #1, falling back to client-side')
    );
  });

  test('should respect ssrDiagrams filter', async () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'code',
          lang: 'mermaid',
          value: 'architecture-beta\n    service(test)[Test]'
        }
      ]
    };

    const plugin = remarkMermaidPluginSSR({ 
      logger: mockLogger,
      ssrDiagrams: ['flowchart'] // Only flowcharts allowed for SSR
    });
    
    await plugin(tree, { path: 'test.md' });

    // Should use client-side since architecture is not in ssrDiagrams
    expect(tree.children[0].value).toBe('<pre class="mermaid">architecture-beta\n    service(test)[Test]</pre>');
    expect(mockLogger.info).toHaveBeenCalledWith(
      'SSR skipped for diagram type, using client-side for block #1'
    );
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
          lang: 'javascript', 
          value: 'console.log("not mermaid")'
        },
        {
          type: 'code',
          lang: 'mermaid',
          value: 'sequenceDiagram\n    A->>B: Hello'
        }
      ]
    };

    const plugin = remarkMermaidPluginSSR({ logger: mockLogger, timeout: 100 });
    await plugin(tree, { path: 'test.md' });

    // Should process only mermaid blocks
    expect(tree.children[0].type).toBe('html');
    expect(tree.children[1]).toEqual({
      type: 'code',
      lang: 'javascript',
      value: 'console.log("not mermaid")'
    });
    expect(tree.children[2].type).toBe('html');
    
    expect(mockLogger.info).toHaveBeenCalledWith('SSR processed 2 mermaid blocks total');
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

    const plugin = remarkMermaidPluginSSR({ timeout: 100 });
    await plugin(tree, {});

    // Should fallback gracefully
    expect(tree.children[0].type).toBe('html');
  });
});