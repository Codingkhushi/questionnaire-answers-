// Unit test for the citation validation logic
// Extracted from generateAnswers.js for testability

function validateCitations(groqResponse, retrievedChunks) {
  const validChunkIds = new Set(retrievedChunks.map(c => c.id));
  return groqResponse.map(answer => {
    const validatedCitations = answer.citations.filter(citeId =>
      validChunkIds.has(citeId)
    );
    return {
      ...answer,
      citations: validatedCitations,
      hasUnverifiedCitation: validatedCitations.length < answer.citations.length
    };
  });
}

describe('Citation Validation — Hallucination Prevention', () => {
  const mockChunks = [
    { id: 'chunk_1', source_filename: 'security_policy.txt' },
    { id: 'chunk_2', source_filename: 'data_retention.txt' },
    { id: 'chunk_3', source_filename: 'incident_response.txt' }
  ];

  test('should pass valid citations through unchanged', () => {
    const groqResponse = [{
      batch_index: 0,
      answer: 'AES-256 encryption is used.',
      citations: ['chunk_1', 'chunk_2']
    }];

    const result = validateCitations(groqResponse, mockChunks);
    expect(result[0].citations).toEqual(['chunk_1', 'chunk_2']);
    expect(result[0].hasUnverifiedCitation).toBe(false);
  });

  test('should strip hallucinated citation not in retrieved chunks', () => {
    const groqResponse = [{
      batch_index: 0,
      answer: 'Some answer.',
      citations: ['chunk_1', 'chunk_HALLUCINATED']
    }];

    const result = validateCitations(groqResponse, mockChunks);
    expect(result[0].citations).toEqual(['chunk_1']);
    expect(result[0].hasUnverifiedCitation).toBe(true);
  });

  test('should return empty citations if all are hallucinated', () => {
    const groqResponse = [{
      batch_index: 0,
      answer: 'Made up answer.',
      citations: ['fake_chunk_1', 'fake_chunk_2']
    }];

    const result = validateCitations(groqResponse, mockChunks);
    expect(result[0].citations).toEqual([]);
    expect(result[0].hasUnverifiedCitation).toBe(true);
  });

  test('should handle multiple answers in a batch', () => {
    const groqResponse = [
      { batch_index: 0, answer: 'Answer 1', citations: ['chunk_1'] },
      { batch_index: 1, answer: 'Answer 2', citations: ['chunk_FAKE'] },
      { batch_index: 2, answer: 'Answer 3', citations: ['chunk_2', 'chunk_3'] }
    ];

    const result = validateCitations(groqResponse, mockChunks);
    expect(result[0].hasUnverifiedCitation).toBe(false);
    expect(result[1].hasUnverifiedCitation).toBe(true);
    expect(result[2].hasUnverifiedCitation).toBe(false);
  });

  test('should handle answer with no citations', () => {
    const groqResponse = [{
      batch_index: 0,
      answer: 'Not found in references.',
      citations: []
    }];

    const result = validateCitations(groqResponse, mockChunks);
    expect(result[0].citations).toEqual([]);
    expect(result[0].hasUnverifiedCitation).toBe(false);
  });
});

describe('Confidence Score Calculation', () => {
  function computeConfidence(similarityScore) {
    return Math.min(similarityScore * 1.5, 1.0);
  }

  test('high similarity should give high confidence', () => {
    expect(computeConfidence(0.8)).toBeCloseTo(1.0);
  });

  test('medium similarity should give medium confidence', () => {
    expect(computeConfidence(0.5)).toBeCloseTo(0.75);
  });

  test('confidence should never exceed 1.0', () => {
    expect(computeConfidence(0.99)).toBeLessThanOrEqual(1.0);
  });

  test('zero similarity should give zero confidence', () => {
    expect(computeConfidence(0)).toBe(0);
  });
});