# LLM setup (Gemini, Groq, or OpenAI)

The compliance agent uses an LLM only to **explain** violations using retrieved regulations. It does not make compliance decisions.

## Gemini (no extra package required)

1. **Create a `.env` file** in the project root (same folder as `compliance_agent.py`).

2. **Edit `.env`** and set your Gemini API key:
   ```
   GEMINI_API_KEY=AIza_your_actual_key_here
   ```
   **Do not commit `.env`** — it is in `.gitignore`.

3. **Optional:** Use a different Gemini model (default is `gemini-1.5-flash`):
   ```
   GEMINI_MODEL=gemini-1.5-pro
   ```

## Groq (alternative)

If you prefer Groq, set in `.env`:
```
GROQ_API_KEY=gsk_your_actual_key_here
```
Optional: `GROQ_MODEL=llama-3.1-8b-instant`.

## OpenAI (alternative)

If you prefer OpenAI, set in `.env`:
```
OPENAI_API_KEY=sk-your_openai_key_here
```
Optional: `OPENAI_MODEL=gpt-4o-mini` (default).

**Precedence:** If multiple keys are set, provider order is **Gemini -> Groq -> OpenAI**.
You can force a provider with:
```
LLM_PROVIDER=gemini
```

## Using the LLM

- **Notebook 05:** Run all cells. The first cell loads `.env` and sets `USE_LLM=True` when a key is present. You should see RAG-grounded explanations in the output.
- **CLI:** Export the key or use `.env`, then:
  ```bash
  export COMPLIANCE_USE_LLM=1
  python compliance_agent.py path/to/report.txt
  ```
- **From Python:** Ensure `GEMINI_API_KEY`, `GROQ_API_KEY`, or `OPENAI_API_KEY` is in the environment (or in `.env`), then call `run(report_text, use_llm=True)`.
