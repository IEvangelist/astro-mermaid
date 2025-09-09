/**
 * Tests for the factory pattern plugin selector
 */
import { describe, test, expect, vi } from 'vitest';
import { createMermaidRemarkPlugin } from '../src/factory.js';

describe('Factory Plugin Selection', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should select client-side plugin by default', () => {
    const plugin = createMermaidRemarkPlugin({ logger: mockLogger });
    
    expect(typeof plugin).toBe('function');
    expect(mockLogger.info).toHaveBeenCalledWith('Using client-side mermaid plugin (default)');
  });

  test('should select SSR plugin when ssr: true', () => {
    const plugin = createMermaidRemarkPlugin({ 
      ssr: true, 
      logger: mockLogger 
    });
    
    expect(typeof plugin).toBe('function');
    expect(mockLogger.info).toHaveBeenCalledWith('Using SSR mermaid plugin');
  });

  test('should pass options correctly to selected plugin', () => {
    const options = {
      ssr: false,
      theme: 'forest',
      timeout: 5000,
      ssrDiagrams: ['flowchart'],
      logger: mockLogger
    };
    
    const plugin = createMermaidRemarkPlugin(options);
    expect(typeof plugin).toBe('function');
    expect(mockLogger.info).toHaveBeenCalledWith('Using client-side mermaid plugin (default)');
  });

  test('should handle missing logger gracefully', () => {
    const plugin = createMermaidRemarkPlugin({ ssr: true });
    expect(typeof plugin).toBe('function');
  });
});