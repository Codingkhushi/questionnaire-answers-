# NovaSec Questionnaire Answering Tool

## What I Built
An AI-powered tool that automates vendor security questionnaire completion 
using RAG (Retrieval-Augmented Generation). Users upload reference documents 
and a questionnaire, and the system generates grounded answers with citations.

## Fictional Company
**NovaSec Inc.** — A B2B SaaS company providing cloud-based endpoint security 
and threat monitoring for mid-sized enterprises. Clients regularly send vendor 
security questionnaires before signing contracts.

**Industry:** SaaS / Cybersecurity

## Tech Stack
- Frontend: React.js (Vercel)
- Backend: Node.js + Express (Render)
- Database: PostgreSQL + pgvector extension
- LLM: Groq API (llama-3.1-8b-instant)
- Embeddings: HuggingFace Inference API (all-MiniLM-L6-v2, 384 dimensions)

## Architecture
1. Reference docs are uploaded, chunked (300 words, 50-word overlap), 
   embedded via HuggingFace, and stored in pgvector
2. Questionnaire is parsed into individual questions via a Groq LLM call
3. For each question, top-3 semantically similar chunks are retrieved 
   using cosine similarity search (pgvector <=> operator)
4. Questions are batched in groups of 3 and sent to Groq with a strict 
   grounding prompt — answers must come only from provided chunks
5. Citations are validated against retrieved chunk IDs to prevent hallucination
6. Users can review, edit answers, and export a structured PDF

## Assumptions
- Reference documents are in English plain text or PDF format
- Questionnaires follow standard numbered/lettered list format
- One user session per questionnaire run (no concurrent generation)

## Trade-offs
- **Batch size of 3**: Chosen to stay within Groq free tier TPM limits (6000/min)
- **Separate embedding provider**: Groq specializes in inference, not embeddings. 
  HuggingFace provides free, adequate quality embeddings for this use case
- **pgvector over ChromaDB**: Single database for relational + vector data 
  reduces infrastructure complexity
- **Eager embedding on upload**: Documents are processed immediately on upload 
  so generation can start without delay. Status polling keeps UX responsive
- **Threshold of -0.9**: With all-MiniLM-L6-v2 and cosine distance, scores 
  vary by domain. Threshold is permissive to allow retrieval; confidence score 
  communicates quality to the user instead

## Design Decisions
- **Hallucination prevention**: Backend validates all citation chunk_ids against 
  the retrieved set. Any citation not in the retrieved context is flagged as unverified
- **Chunk overlap**: 50-word overlap prevents context loss at paragraph/page boundaries
- **temperature=0.1**: Low temperature keeps LLM answers factual and close to source text
- **is_edited flag**: Tracks human edits separately from AI output. Citations are 
  preserved even after manual edits for traceability

## What I Would Improve With More Time
- Re-embed with a higher quality model (OpenAI text-embedding-3-small)
- Add proper job queue (Bull/Redis) instead of fire-and-forget async
- Table extraction from questionnaire PDFs using officeparser
- Version history to compare multiple generation runs
- Partial regeneration for individual questions
- Better chunking strategy using semantic paragraph boundaries
