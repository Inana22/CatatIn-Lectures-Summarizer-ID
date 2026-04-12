from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from transformers import BertTokenizer, BertModel
import torch
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

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
# If you have a custom folder, replace 'indobenchmark/indobert-base-p1' with your path.
MODEL_NAME = "indobert_extractive_model"

print(f"Loading model {MODEL_NAME}...")
tokenizer = BertTokenizer.from_pretrained(MODEL_NAME)
model = BertModel.from_pretrained(MODEL_NAME)
model.eval()

class SummarizeRequest(BaseModel):
    text: str
    num_sentences: int = 3

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

    # --- Aggressive Sentence Splitting (Optimized for Transcripts) ---
    # We ignore punctuation and split purely by word count/chunks for long texts
    all_words = request.text.split()
    word_count = len(all_words)
    
    sentences = []
    # If text is long, split every 20 words to create "artificial sentences"
    if word_count > 50:
        for i in range(0, word_count, 20):
            segment = " ".join(all_words[i:i + 20])
            if segment:
                sentences.append(segment)
    else:
        # For short text, just use it as is
        sentences = [request.text.strip()]
    
    # Debug print to console (you can see this in your terminal)
    print(f"DEBUG: Processing {word_count} words into {len(sentences)} segments.")

    if len(sentences) == 0:
        return {"summary": "", "points": []}

    # If it's still effectively 1 segment, return it
    if len(sentences) == 1:
        return {"summary": sentences[0], "points": sentences}

    # --- Long Document Strategy (Chunking) ---
    CHUNK_SIZE = 15 
    chunks = [sentences[i:i + CHUNK_SIZE] for i in range(0, len(sentences), CHUNK_SIZE)]
    
    candidate_sentences = []
    for chunk in chunks:
        embeddings = [get_sentence_embedding(s) for s in chunk]
        embeddings = np.vstack(embeddings)
        centroid = np.mean(embeddings, axis=0).reshape(1, -1)
        similarities = cosine_similarity(embeddings, centroid).flatten()

        num_candidates = min(2, len(chunk))
        top_indices = np.argsort(similarities)[-num_candidates:]
        for idx in top_indices:
            candidate_sentences.append(chunk[idx])

    # --- Final Selection from Candidates ---
    if len(candidate_sentences) <= request.num_sentences:
        final_sentences = candidate_sentences
    else:
        cand_embeddings = [get_sentence_embedding(s) for s in candidate_sentences]
        cand_embeddings = np.vstack(cand_embeddings)
        global_centroid = np.mean(cand_embeddings, axis=0).reshape(1, -1)
        global_similarities = cosine_similarity(cand_embeddings, global_centroid).flatten()
        
        final_indices = np.argsort(global_similarities)[-request.num_sentences:]
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
