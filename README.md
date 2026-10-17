# Hack the Valley

## OpenSpec (optional)

[OpenSpec](https://github.com/Fission-AI/OpenSpec) helps you plan changes with an AI coding assistant before implementing them. It keeps proposals, requirements, designs, and task lists in `openspec/` so the team can review the plan alongside the code.

This repo already includes OpenSpec configuration and Codex skills in `.agents/skills/`.

### Install

Requires Node.js 20.19.0 or newer and npm. Install the CLI on your machine:

```sh
npm install -g @fission-ai/openspec@latest
openspec --version
```

For a new project, initialize OpenSpec from its root with Codex selected:

```sh
openspec init --tools codex
```

This repo is already initialized, so you can skip that step.

### Use with Codex

In a Codex conversation opened in this repo, start a proposal:

```text
$openspec-propose "Describe the feature or fix"
```

Review the generated plan, then use `$openspec-apply-change` to implement it. After implementation is complete, use `$openspec-archive-change` to archive it.

See the [installation guide](https://github.com/Fission-AI/OpenSpec/blob/main/docs/installation.md) for more setup options.
