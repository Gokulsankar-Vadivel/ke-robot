"""End-to-end RAG answer generation using hybrid retrieval and local Ollama LLM."""

from typing import Any, Dict, List, Optional

from config import MIN_RELEVANCE_SCORE, OLLAMA_BASE_URL, OLLAMA_DEFAULT_MODEL, TOP_K_RESULTS
from modules.embedding_manager import EmbeddingManager
from modules.hybrid_search import hybrid_search
from modules.source_manager import prepare_sources
from modules.vector_database import VectorDatabase


def check_ollama_available(base_url: str = OLLAMA_BASE_URL) -> bool:
    try:
        import requests  # type: ignore

        resp = requests.get(f"{base_url}/api/tags", timeout=1.0)
        return resp.status_code == 200
    except Exception:
        return False


def generate_ollama_answer(
    prompt: str,
    model: str = OLLAMA_DEFAULT_MODEL,
    base_url: str = OLLAMA_BASE_URL,
) -> str:
    try:
        import requests  # type: ignore

        resp = requests.post(
            f"{base_url}/api/generate",
            json={"model": model, "prompt": prompt, "stream": False, "options": {"temperature": 0.2}},
            timeout=45,
        )
        if resp.status_code != 200:
            raise RuntimeError("The AI model is not available. Please start Ollama.")
        data = resp.json()
        text = (data.get("response") or "").strip()
        if not text:
            raise RuntimeError("Ollama returned an empty response.")
        return text
    except Exception as exc:
        raise RuntimeError("The AI model is not available. Please start Ollama.") from exc


def build_rag_prompt(question: str, sources: List[Dict[str, Any]], history: Optional[List[Dict[str, str]]] = None) -> str:
    context = "\n\n---\n\n".join(
        f"[Source {s['citation_index']}] Document: {s['filename']} | Page: {s['page_number']}\n{s['excerpt']}"
        for s in sources
    )
    history_block = ""
    if history:
        turns = [f"{h['role'].title()}: {h['content']}" for h in history[-4:]]
        history_block = "Recent Conversation:\n" + "\n".join(turns) + "\n\n"

    return (
        "You are ROBO KNOWLEDGE AI, an institutional robotics engineering assistant.\n"
        "Answer ONLY using the retrieved context below. Cite sources inline as [Source 1], [Source 2].\n"
        "If the context lacks sufficient details, state clearly that the uploaded knowledge base does not contain the answer.\n\n"
        f"{history_block}"
        f"Context:\n{context}\n\n"
        f"Question: {question}\n\nAnswer:"
    )


def answer_question(
    question: str,
    db: VectorDatabase,
    embedder: EmbeddingManager,
    mode: str = "hybrid",
    top_k: int = TOP_K_RESULTS,
    domain_filter: Optional[str] = None,
    history: Optional[List[Dict[str, str]]] = None,
    ollama_model: str = OLLAMA_DEFAULT_MODEL,
) -> Dict[str, Any]:
    clean_q = question.strip()
    retrieved = hybrid_search(
        clean_q,
        db=db,
        embedder=embedder,
        top_k=top_k,
        mode=mode,
        domain_filter=domain_filter,
    )

    top_score = retrieved[0]["combined_score"] if retrieved else 0.0
    relevant = [r for r in retrieved if r["combined_score"] >= MIN_RELEVANCE_SCORE]

    if not relevant:
        db.log_search(clean_q, mode, top_score, 0, has_gap=True)
        return {
            "answer": "No relevant information was found in the uploaded documents.",
            "sources": [],
            "insufficient_evidence": True,
            "top_score": top_score,
        }

    sources = prepare_sources(relevant)
    prompt = build_rag_prompt(clean_q, sources, history=history)
    answer_text = generate_ollama_answer(prompt, model=ollama_model)

    db.log_search(clean_q, mode, top_score, len(sources), has_gap=False)
    return {
        "answer": answer_text,
        "sources": sources,
        "insufficient_evidence": False,
        "top_score": top_score,
    }
