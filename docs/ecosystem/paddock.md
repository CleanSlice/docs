# Paddock

> Automated eval & improvement loop for AI agents. Generates test scenarios, runs the agent, scores with multi-model consensus (Claude + GPT + Gemini), and iteratively patches code until quality targets are met.

- **Repository:** [github.com/CleanSlice/paddock](https://github.com/CleanSlice/paddock)

## What it does

Paddock is a closed-loop CI for agents. You point it at a runtime, it produces a pass/fail rate, and — if you let it — it edits the agent's code until the pass rate clears your threshold.

```
Scenarios (.yml) → Agent Runtime (mock channel) → 3 LLM Judges → Consensus
                                                                     │
                                                              pass ≥ 80%?
                                                             /           \
                                                           YES            NO
                                                            │              │
                                                       git push      Analyze + Patch
                                                                          │
                                                                    Sandbox OK?
                                                                   /          \
                                                                 YES          NO
                                                                  │            │
                                                              Commit        Revert
                                                                  │
                                                              ← repeat
```

## How it works

1. **Load scenarios** from `.paddock/scenarios/` in the target project (YAML, organized by category).
2. **Run each scenario** against the agent via a mock channel — captures responses, tool calls, errors, timing.
3. **3 LLM judges** (Claude, Gemini, GPT) independently score each run on correctness, tool usage, SOUL compliance, response quality, error handling.
4. **Consensus** — median scores + majority vote → pass / fail / partial.
5. **If failing** — analyzer finds patterns, patcher generates code fixes, sandbox validates (type-check + build).
6. **Repeat** until pass rate ≥ threshold or budget exhausted.
7. **Git** — all work happens on `eval/*` branches; push only on success.

## Quick start

```bash
git clone https://github.com/cleanslice/paddock.git
cd paddock
bun install
cp .env.example .env
# Add API keys, then:

bun run eval --repo /path/to/agent-repo
```

### Common commands

```bash
bun run eval --repo /path/to/agent-repo                    # full loop
bun run eval:quick --repo /path/to/agent-repo              # 3 scenarios, no improvement
bun run eval:no-improve --repo /path/to/agent-repo         # evaluate only
bun run eval:category tool_use --repo /path/to/agent-repo  # one category
bun run scenarios --repo /path/to/agent-repo               # preview loaded scenarios
```

### Useful flags

| Flag | Purpose |
|------|---------|
| `--repo` | Path to agent runtime repo (or `EVAL_REPO_ROOT`) |
| `--agent-dir` | Path to `.agent` directory |
| `--categories` | `tool_use,memory,conversation,edge_case,multi_turn,error_recovery` |
| `--difficulties` | `easy,medium,hard,adversarial` |
| `--count` | Number of scenarios (default: 10) |
| `--threshold` | Pass rate 0–1 (default: 0.8) |
| `--max-iter` | Max improvement iterations (default: 5) |
| `--no-improve` | Evaluate only, skip auto-improvement |

## Required keys

At least one LLM key is required; Claude is preferred. Add Gemini and GPT for true 3-judge consensus.

```bash
CLAUDE_CODE_OAUTH_TOKEN=token1,token2,token3   # auto-rotation on rate limit
ANTHROPIC_API_KEY=sk-ant-...                    # fallback
GEMINI_API_KEY=AIza...                          # optional
OPENAI_API_KEY=sk-...                           # optional
```
