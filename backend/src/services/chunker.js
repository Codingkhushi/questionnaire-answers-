function chunkWithOverlap(text, chunkSize = 300, overlap = 50) {
  const words = text.split(' ').filter(w => w.trim());
  const chunks = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim()) chunks.push(chunk);
    i += (chunkSize - overlap);
  }
  return chunks;
}

module.exports = { chunkWithOverlap };