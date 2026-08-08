FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

# poppler-utils provides pdftotext, used by scripts/extract_text.py
RUN apt-get update \
    && apt-get install -y --no-install-recommends poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Keep the venv outside /app so it survives the bind mount in docker-compose.yml
ENV UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_LINK_MODE=copy \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project

COPY scripts/ scripts/
COPY agent/ agent/

CMD ["bash"]
