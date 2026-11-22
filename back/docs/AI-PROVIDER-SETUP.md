# AI provider setup

upwin needs one OpenAI-compatible endpoint with **structured output** (JSON schema). The API
makes one model call per analysis, per proposal draft, and so on. The model returns criteria
scores, and the API computes the final score itself, from versioned weights.

A provider is required: the API refuses to start without one, and names the missing setting.
There is no sample mode.

## Recommended: llmgateway.io

[llmgateway.io](https://llmgateway.io) is one key and one base URL in front of about 40 model
providers. upwin was built and tested against it.

- **Fallbacks can cross vendors.** If the primary model fails, the fallback can come from
  another company, for example an OpenAI primary with an Anthropic fallback.
- **The model console works out of the box.** Settings → AI models lists the gateway's live
  catalog, with prices.

### Steps

1. Create an account on llmgateway.io, add credit, and create an API key.
2. In the API's `.env`:

   ```bash
   AI_BASE_URL=https://api.llmgateway.io/v1
   AI_API_KEY=<your key>
   ```

3. Leave `AI_MODEL` empty: the built-in defaults work on the gateway. Restart the API.
   Settings → AI models changes the model per task later, without a restart.
4. Check that **Settings → Connection** in the web app lists the model each task uses.

### Rules that matter (measured against the gateway)

- **Use bare model ids,** like `gpt-4.1-mini`, never `openai/gpt-4.1-mini`.
  - Pinning a provider can route the request to an upstream that lacks JSON-schema support.
  - The bare id lets the gateway pick one that has it.
  - Example: `deepseek-v4-flash` works, while `alibaba/deepseek-v4-flash` fails.
- **Not every model supports structured output.** Some of the cheapest ones answer *"does not
  support JSON schema output mode"*.
  - The cheapest models verified to work are `gpt-4.1-nano` and `gemini-2.5-flash-lite`, both at
    $0.10 / $0.40 per million input / output tokens.
  - `gpt-4.1-mini` is the default for the analyzer, the job match, and the proposal writer;
    `gpt-4.1-nano` for the profile improver and the CV extractor.
  - A failed call retries the same model. For a fallback from another vendor, such as
    `claude-haiku-4-5`, set the task's `*_FALLBACK` key (see below).
- **The upstream that answered can change from call to call.** Each analysis records the model
  that actually served it, so you can see it in the API's data.

## Other providers

Any endpoint that speaks the OpenAI chat-completions API with `response_format: json_schema`
works. Set `AI_MODEL` to one of that provider's model ids, and every task uses it.

| Provider | `AI_BASE_URL` | Example `AI_MODEL` | Key |
|---|---|---|---|
| OpenAI | `https://api.openai.com/v1` | leave empty: the defaults are OpenAI ids | required |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-4.1-mini` | required |
| Ollama (local) | `http://localhost:11434/v1` | `llama3.1:8b` | leave `AI_API_KEY` empty |
| LM Studio (local) | `http://localhost:1234/v1` | the model's id in LM Studio | leave empty |

- **Model console.** It only lists llmgateway.io's catalog format. With other providers, the
  models you set in `.env` are used as they are.
- **Local models in Docker.** If the API runs in Docker and Ollama runs on the host, use
  `http://host.docker.internal:11434/v1`.
- **Small local models** are often too weak for the structured rubric. If analyses come back
  invalid, try a larger model before anything else.

## Per-task models (optional)

Most installs never need these. A task uses the first of:

1. the model picked in Settings → AI models (llmgateway.io only);
2. its own `AI_MODEL_<TASK>_PRIMARY` and `AI_MODEL_<TASK>_FALLBACK`;
3. `AI_MODEL`;
4. the built-in default.

An empty `*_FALLBACK` retries the primary. Use model ids from one provider throughout, unless
that provider is llmgateway.io.

| Variables | Used for |
|---|---|
| `AI_MODEL_PROFILE_ANALYZER_*` | the profile score and recommendations |
| `AI_MODEL_PROFILE_IMPROVER_*` | rewrite suggestions for profile sections |
| `AI_MODEL_CV_EXTRACTOR_*` | turning an uploaded CV into your context |
| `AI_MODEL_JOB_MATCH_EVALUATOR_*` | the job fit score |
| `AI_MODEL_PROPOSAL_WRITER_*` | proposal drafts and screening answers |

Settings → AI models can override the analyzer, job-match and proposal-writer models at runtime,
without a restart.
