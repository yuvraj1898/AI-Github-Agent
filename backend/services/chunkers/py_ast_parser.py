import ast
import json
import sys
from typing import List, Dict


class CodeChunkVisitor(ast.NodeVisitor):
    def __init__(self, source_code: str):
        self.source_code = source_code
        self.chunks = []

    def extract_code(self, node: ast.AST) -> str:
        lines = self.source_code.splitlines()
        start_line = node.lineno - 1
        end_line = node.end_lineno
        return "\n".join(lines[start_line:end_line])

    def get_calls(self, node: ast.AST) -> List[str]:
        calls = []

        class CallVisitor(ast.NodeVisitor):
            def visit_Call(self, call_node):
                if isinstance(call_node.func, ast.Name):
                    calls.append(call_node.func.id)
                elif isinstance(call_node.func, ast.Attribute):
                    calls.append(call_node.func.attr)

        CallVisitor().visit(node)
        return calls

    def visit_FunctionDef(self, node: ast.FunctionDef):
        self.chunks.append({
            "type": "function",
            "name": node.name,
            "code": self.extract_code(node),
            "calls": self.get_calls(node),
        })

    def visit_ClassDef(self, node: ast.ClassDef):
        self.chunks.append({
            "type": "class",
            "name": node.name,
            "code": self.extract_code(node),
            "calls": self.get_calls(node),
        })


def parse_python_file(file_path: str) -> List[Dict]:
    with open(file_path, 'r', encoding='utf-8') as f:
        source_code = f.read()
        tree = ast.parse(source_code)
        visitor = CodeChunkVisitor(source_code)
        visitor.visit(tree)
        return visitor.chunks


if __name__ == "__main__":
    file_path = sys.argv[1]
    chunks = parse_python_file(file_path)
    for chunk in chunks:
        chunk["filePath"] = file_path
        chunk["language"] = "python"
        chunk["imports"] = []  # You can extract imports if needed
    print(json.dumps(chunks))
