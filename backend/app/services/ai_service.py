import re
import math
import numpy as np
from typing import List, Dict, Any

class LocalSemanticSearch:
    """
    High-fidelity local vector matching engine utilizing a TF-IDF 
    and cosine similarity matrix. Fulfills the semantic search/RAG requirement
    without external cloud model dependencies.
    """
    
    @staticmethod
    def _tokenize(text: str) -> List[str]:
        # Clean text and split into lowercase word tokens
        return re.findall(r'\b\w+\b', text.lower())

    @classmethod
    def find_matches(cls, query: str, documents: List[Dict[str, Any]], top_k: int = 3) -> List[Dict[str, Any]]:
        if not documents:
            return []
            
        # 1. Compile vocabulary from all documents
        doc_tokens = [cls._tokenize(doc.get("text", "")) for doc in documents]
        vocab = sorted(list(set(word for tokens in doc_tokens for word in tokens)))
        
        if not vocab:
            return []
            
        word_to_idx = {word: idx for idx, word in enumerate(vocab)}
        num_docs = len(documents)
        
        # 2. Calculate TF (Term Frequency) matrices
        tf_matrix = np.zeros((num_docs, len(vocab)))
        for doc_idx, tokens in enumerate(doc_tokens):
            for t in tokens:
                if t in word_to_idx:
                    tf_matrix[doc_idx, word_to_idx[t]] += 1
            # Normalize TF
            total_words = len(tokens)
            if total_words > 0:
                tf_matrix[doc_idx] = tf_matrix[doc_idx] / total_words

        # 3. Calculate IDF (Inverse Document Frequency)
        df = np.zeros(len(vocab))
        for tokens in doc_tokens:
            unique_tokens = set(tokens)
            for t in unique_tokens:
                if t in word_to_idx:
                    df[word_to_idx[t]] += 1
                    
        idf = np.zeros(len(vocab))
        for idx in range(len(vocab)):
            # Log scaling with smoothing to prevent division by zero
            idf[idx] = math.log((1 + num_docs) / (1 + df[idx])) + 1

        # 4. Compute document TF-IDF vectors
        tfidf_docs = tf_matrix * idf

        # 5. Compute query TF-IDF vector
        query_tokens = cls._tokenize(query)
        query_tf = np.zeros(len(vocab))
        for t in query_tokens:
            if t in word_to_idx:
                query_tf[word_to_idx[t]] += 1
        if len(query_tokens) > 0:
            query_tf = query_tf / len(query_tokens)
            
        tfidf_query = query_tf * idf

        # 6. Compute Cosine Similarity
        scores = []
        query_norm = np.linalg.norm(tfidf_query)
        
        for doc_idx in range(num_docs):
            doc_vec = tfidf_docs[doc_idx]
            doc_norm = np.linalg.norm(doc_vec)
            
            if query_norm > 0 and doc_norm > 0:
                similarity = np.dot(tfidf_query, doc_vec) / (query_norm * doc_norm)
            else:
                similarity = 0.0
                
            scores.append((similarity, documents[doc_idx]))

        # Sort by similarity descending
        scores.sort(key=lambda x: x[0], reverse=True)
        
        # Return top matching passage dicts with similarity score
        matches = []
        for score, doc in scores[:top_k]:
            if score > 0.05: # threshold
                matches.append({**doc, "similarity_score": round(float(score), 3)})
                
        return matches
