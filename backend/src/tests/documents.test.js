const { chunkWithOverlap } = require('../services/chunker');

describe('Chunker — chunkWithOverlap', () => {
  test('should split text into chunks of correct size', () => {
    // Create text with exactly 600 words
    const text = Array(600).fill('word').join(' ');
    const chunks = chunkWithOverlap(text, 300, 50);

    // First chunk should have 300 words
    expect(chunks[0].split(' ').length).toBe(300);
  });

  test('should create overlap between consecutive chunks', () => {
    const words = Array.from({ length: 400 }, (_, i) => `word${i}`);
    const text = words.join(' ');
    const chunks = chunkWithOverlap(text, 300, 50);

    // Last 50 words of chunk 1 should appear at start of chunk 2
    const endOfChunk1 = chunks[0].split(' ').slice(-50);
    const startOfChunk2 = chunks[1].split(' ').slice(0, 50);
    expect(endOfChunk1).toEqual(startOfChunk2);
  });

  test('should handle text shorter than chunk size', () => {
    const text = 'short text here';
    const chunks = chunkWithOverlap(text, 300, 50);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe(text);
  });

  test('should not produce empty chunks', () => {
    const text = Array(500).fill('word').join(' ');
    const chunks = chunkWithOverlap(text, 300, 50);
    chunks.forEach(chunk => {
      expect(chunk.trim().length).toBeGreaterThan(0);
    });
  });

  test('should preserve word order across chunks', () => {
    const words = Array.from({ length: 350 }, (_, i) => `unique${i}`);
    const text = words.join(' ');
    const chunks = chunkWithOverlap(text, 300, 50);

    // unique0 should be in first chunk
    expect(chunks[0]).toContain('unique0');
    // unique299 should be in first chunk
    expect(chunks[0]).toContain('unique299');
    // unique349 should be in last chunk
    expect(chunks[chunks.length - 1]).toContain('unique349');
  });

  test('should handle redundant whitespace and newlines', () => {
    const text = 'word1 \n\n  word2    word3';
    const chunks = chunkWithOverlap(text, 10, 2);
    expect(chunks[0]).toBe('word1 word2 word3');
  });

  test('should return empty array for empty string', () => {
    const chunks = chunkWithOverlap('', 300, 50);
    expect(chunks).toEqual([]);
  });

  test('should return empty array for only whitespace', () => {
    const chunks = chunkWithOverlap('   ', 300, 50);
    expect(chunks).toEqual([]);
  });
});