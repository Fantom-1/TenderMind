from pathlib import Path

PROMPTS_DIR = Path(__file__).resolve().parent


def load_prompt(name: str) -> str:
    """Load a prompt template by file name (without extension)."""
    path = PROMPTS_DIR / f"{name}.txt"
    if not path.exists():
        raise FileNotFoundError(f"prompt not found: {name} (looked in {PROMPTS_DIR})")
    return path.read_text(encoding="utf-8")


def render(template: str, **fields: object) -> str:
    """Tiny {{KEY}} substitution. Avoids importing a heavy templating engine."""
    out = template
    for key, value in fields.items():
        out = out.replace(f"{{{{{key.upper()}}}}}", str(value))
    return out
