# pstack in Pi

This directory contains the upstream pstack skills and supporting files, installed for this repository under `.agents/skills/pstack/`.

## Use it

- Start a rigorous task with `/skill:poteto-mode` (the upstream skill has model invocation disabled, so invoke it explicitly).
- Run `/skill:setup-pstack` to review the upstream setup guidance. Cursor-specific model names and settings may not apply to Pi; use Pi's configured models instead.
- Other skills are discoverable by name, for example `/skill:how`, `/skill:tdd`, and `/skill:unslop`.

## Pi compatibility notes

The upstream content targets Cursor. Pi discovers and loads the skills, but does not provide Cursor's `/add-plugin`, custom modes, `Task` subagent tool, or Cursor-specific model configuration. If an instruction asks for a Cursor-only feature or unavailable tool, use Pi's available tools and configured models where equivalent; otherwise do that step manually or skip it and report the limitation. In particular, don't claim parallel delegation occurred unless Pi actually performed it.

Upstream files are retained as-is to keep updates easy to compare. See `README.md` for upstream overview and `LICENSE` for the license.
