# codebert_embed.py
import sys
import json
import argparse
from transformers import AutoTokenizer, AutoModel
import torch

def embed_code(code):
    tokenizer = AutoTokenizer.from_pretrained("microsoft/codebert-base")
    model = AutoModel.from_pretrained("microsoft/codebert-base")
    inputs = tokenizer(code, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        outputs = model(**inputs)
    embeddings = outputs.last_hidden_state.mean(dim=1).squeeze().tolist()
    return embeddings

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--single', action='store_true', help="Embed a single input string")
    args = parser.parse_args()

    input_data = sys.stdin.read()

    if args.single:
        try:
            payload = json.loads(input_data)
            code = payload["input"]
            embedding = embed_code(code)
            print(json.dumps({"embedding": embedding}))
        except Exception as e:
            print(json.dumps({"error": str(e)}))
            sys.exit(1)
    else:
        try:
            code_chunks = json.loads(input_data)
            results = []
            for chunk in code_chunks:
                try:
                    embedding = embed_code(chunk["code"])
                    chunk["embedding"] = embedding
                    results.append(chunk)
                except Exception as e:
                    chunk["error"] = str(e)
                    results.append(chunk)
            print(json.dumps(results))
        except Exception as e:
            print(json.dumps({"error": str(e)}))
            sys.exit(1)
