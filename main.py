from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from transformers import BertTokenizer, BertModel
import torch
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

import re

app = FastAPI()

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Configuration ---
# Use IndoBERT base as default. 
MODEL_NAME = "indobert_kmeans_v2_model"

print(f"Loading model {MODEL_NAME}...")
tokenizer = BertTokenizer.from_pretrained(MODEL_NAME)
model = BertModel.from_pretrained(MODEL_NAME)
model.eval()

class SummarizeRequest(BaseModel):
    text: str
    num_sentences: int = 0  # 0 means dynamic scaling

@app.get("/")
async def root():
    return {"message": "CatatIn IndoBERT Backend is ONLINE", "status": "active"}

def get_sentence_embedding(sentence):
    inputs = tokenizer(sentence, return_tensors="pt", truncation=True, padding=True, max_length=512)
    with torch.no_grad():
        outputs = model(**inputs)
    # Use mean pooling of the last hidden state as sentence embedding
    return outputs.last_hidden_state.mean(dim=1).numpy()

@app.post("/summarize")
async def summarize(request: SummarizeRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text is empty")

    all_words = request.text.split()
    word_count = len(all_words)
    
    # --- Dynamic Scaling Logic ---
    if request.num_sentences <= 0:
        target_num = min(15, max(3, word_count // 250))
    else:
        target_num = request.num_sentences

    # --- Smart Sentence Splitting ---
    # Try splitting by punctuation first
    input_text = request.text.strip()
    raw_sentences = re.split(r'(?<=[.!?])\s+', input_text)
    raw_sentences = [s.strip() for s in raw_sentences if len(s.split()) >= 3]

    sentences = []
    # If punctuation-based splitting failed to create enough segments, fallback
    if len(raw_sentences) < 2:
        if word_count > 50:
            # Fallback for long text without punctuation: 30 words per segment
            for i in range(0, word_count, 30):
                segment = " ".join(all_words[i:i + 30])
                if segment:
                    sentences.append(segment)
        else:
            # For short text without punctuation, just use the whole thing as one segment
            sentences = [input_text]
    else:
        # If segments are too long (e.g. 100+ words), break them down
        for s in raw_sentences:
            words = s.split()
            if len(words) > 80:
                for i in range(0, len(words), 50):
                    sentences.append(" ".join(words[i:i + 50]))
            else:
                sentences.append(s)
    
    # Final safety: if for some reason sentences is still empty but we have words
    if not sentences and word_count > 0:
        sentences = [input_text]

    print(f"DEBUG: Word count: {word_count} | Segments: {len(sentences)} | Target Points: {target_num}")

    if not sentences:
        return {"summary": "", "points": []}

    if len(sentences) <= target_num:
        return {
            "summary": "... ".join(sentences) + "...",
            "points": sentences
        }

    # --- Long Document Strategy (Chunking) ---
    # We use a larger chunk size to ensure we cover the whole document
    CHUNK_SIZE = max(10, len(sentences) // target_num)
    chunks = [sentences[i:i + CHUNK_SIZE] for i in range(0, len(sentences), CHUNK_SIZE)]
    
    candidate_sentences = []
    for chunk in chunks:
        embeddings = [get_sentence_embedding(s) for s in chunk]
        embeddings = np.vstack(embeddings)
        centroid = np.mean(embeddings, axis=0).reshape(1, -1)
        similarities = cosine_similarity(embeddings, centroid).flatten()

        # Pick top 2 or 3 candidates from each chunk
        num_candidates = min(3, len(chunk))
        top_indices = np.argsort(similarities)[-num_candidates:]
        for idx in top_indices:
            candidate_sentences.append(chunk[idx])

    # --- Final Selection from Candidates ---
    if len(candidate_sentences) <= target_num:
        final_sentences = candidate_sentences
    else:
        cand_embeddings = [get_sentence_embedding(s) for s in candidate_sentences]
        cand_embeddings = np.vstack(cand_embeddings)
        global_centroid = np.mean(cand_embeddings, axis=0).reshape(1, -1)
        global_similarities = cosine_similarity(cand_embeddings, global_centroid).flatten()
        
        final_indices = np.argsort(global_similarities)[-target_num:]
        final_indices.sort()
        final_sentences = [candidate_sentences[i] for i in final_indices]

    # Clean up and join
    summary_text = "... ".join(final_sentences) + "..."
    return {
        "summary": summary_text,
        "points": final_sentences
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8080)
