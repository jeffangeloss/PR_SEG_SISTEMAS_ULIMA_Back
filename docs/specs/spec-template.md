# Spec Template

Use this template for new backend specs.

```markdown
---
name: Feature Name
description: Short description of the backend behavior.
targets:
  - ../../../src/modules/feature-name/**
  # Add only if the feature changes shared middleware/errors/types.
  # - ../../../src/shared/**
  # Add only if the feature publishes or observes domain events.
  # - ../../../src/events/**
  - ../../../src/db/schema/schema.ts
---

# Feature Name

## Requirements

- R?: Requirement copied or referenced from the product catalog.

## API Contract Draft

- `METHOD /path`: response and behavior summary.

## Rules

- Business rule or authorization rule.
- Error handling rule.
- Persistence rule.
- DTO validation rule.
- Domain event or observer rule, only when this feature has side effects outside the main request.

## Verification

- Add `[@test] path/to/test` links after tests exist.
```

Do not add `[@test]` links that point to files that do not exist.
