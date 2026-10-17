# Git Workflow

## Commits

- Before creating a commit, read `.gitmessage`.
- Follow the commit message format defined there.
- Use descriptive, concise commit messages.
- Use the required format even when running `git commit -m`.
- Do not commit unrelated changes.
- Only create commits when requested by the user.

## Pull Requests

- Before creating a PR, read `.github/PULL_REQUEST_TEMPLATE.md`.
- Follow the template's structure exactly.
- Fill in each relevant section with accurate information.
- Summarize actual changes from the Git diff.
- When using GitHub CLI, provide a populated PR body
  instead of relying on automatically generated commit summaries.
- Do not merge PRs without explicit permission.

## General

- Follow existing branch naming conventions.
- Review changes before committing.
- Prefer small, focused commits.
