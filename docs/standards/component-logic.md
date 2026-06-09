# Component Logic (Humble Object)

These conventions apply to frontend components in the `app/` project. They build on the [Nuxt Standards](/standards/nuxt) and describe where a component's *decisions* live.

Pull branching decision logic out of `.vue` components into sibling pure `*.logic.ts` files. The `.vue` stays a thin shell; the decision logic becomes a pure, framework-free function that is unit-tested in isolation and imported by **both** the component and its test. This is the Humble Object / functional-core pattern: keep the hard-to-test thing (a rendered component) dumb, and keep the easy-to-test thing (a pure function) where the real decisions live.

## What `*.logic.ts` Is

A `*.logic.ts` file sits next to a component and exports **pure functions** that encode the component's decisions — which states are reachable, whether an action is allowed, how a status maps to a label. The component imports those functions and renders their results; it does not re-derive them inline.

```
components/
└── onboarding/
    ├── ApprovalPopover.vue          # thin shell — renders what the logic returns
    ├── approvalPopover.logic.ts     # pure decisions — no Vue, no reactivity
    └── __tests__/
        ├── approvalPopover.logic.test.ts   # unit-tests the pure functions
        └── ApprovalPopover.test.ts         # mount test: template routes through the logic
```

The value of the pattern is **testing against shipped code**. Because the same function is imported by the component and by the test, a passing unit test is a guarantee about the real component's decisions — not about a copy of them. The one remaining risk — the template not actually *calling* the logic — is closed by a single component-mount test.

::: tip Why "Humble Object"?
A rendered Vue component is awkward to test: it needs a DOM, a mount, async flushes. The pattern makes that object *humble* — stripped of decisions until it's trivially correct by inspection — and moves every decision into a plain function that needs none of that machinery. You get fast, exhaustive unit tests over the logic and one thin test over the wiring.
:::

## The Decision Rule

Use this table to decide where a piece of logic belongs:

| Logic type                                              | Home                          |
| ------------------------------------------------------- | ----------------------------- |
| Branching domain rules / lookup tables / backend mirrors| `*.logic.ts` (pure, no Vue)   |
| Reactive state, effects, lifecycle                      | `composables/useX.ts`         |
| "Does the component render the right thing"             | one component-mount test      |
| Trivial one-line formatting                             | inline in the `.vue`          |

The strongest case for `*.logic.ts` is a **state-transition table or backend mirror** — for example, a frontend copy of the API's `LEGAL_TRANSITIONS` map. That logic is high-consequence, branch-heavy, and drifts dangerously when buried in a template. Pull it out, unit-test every transition, and the component can never silently disagree with the backend.

The weakest case is **trivial one-line formatting** (a date pill, a single `toUpperCase`). Extracting it buys nothing — no branching, nothing to drift — and adds a file. Leave it inline.

## The Purity Rule

A `*.logic.ts` file **must be pure**:

- No `import ... from 'vue'`.
- No `ref` / `computed` / `reactive` / `watch` / `watchEffect`.
- No lifecycle hooks (`onMounted`, etc.).
- No side effects — same inputs, same outputs.

If the logic needs reactivity, it does not belong here — it belongs in `composables/useX.ts`.

::: warning Don't reflexively move these into `composables/`
This question comes up: "it's logic, shouldn't it be a composable?" No. A composable's job is to manage reactive state and effects; it is intrinsically coupled to Vue's reactivity and can only be tested by running Vue. A `*.logic.ts` function takes plain values and returns plain values, so it can be tested as a pure data structure — no mount, no `nextTick`, no reactivity. **Purity is the whole value of the pattern.** The moment you `import { computed } from 'vue'`, you have thrown away the testability you extracted the file to gain. Reactive wrapping is the composable's job; the pure decision underneath is the logic file's job. They compose — a composable may *call* a logic function — but they are not interchangeable.
:::

## Required Header Annotation

Every `*.logic.ts` file carries the CleanSlice layer header. The logic is part of the component, so it is `@layer:component`:

```typescript
// @scope:app
// @slice:cmx/onboarding
// @layer:component
```

`@layer:component` is correct — the logic is the component's brain, not a separate domain layer. Keep these on every logic file you create or touch.

## Enforcing Purity with ESLint

Purity should be mechanical, not cultural. Add an override to the flat ESLint config (`app/eslint.config.mjs`) targeting `**/*.logic.ts`:

```javascript
// app/eslint.config.mjs (flat config)
export default [
  // ...existing config...
  {
    files: ['**/*.logic.ts'],
    rules: {
      // A logic file must never reach for Vue or its reactivity primitives.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'vue',
              message:
                '*.logic.ts must be pure. Reactive logic belongs in composables/useX.ts, not in a logic file.',
            },
          ],
        },
      ],
      // Catch auto-imported reactivity (Nuxt does not require an import for ref/computed/etc.).
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "CallExpression[callee.name=/^(ref|computed|reactive|watch|watchEffect|shallowRef|toRef|toRefs)$/]",
          message:
            '*.logic.ts must be pure: no reactivity. Move reactive logic to composables/useX.ts.',
        },
      ],
    },
  },
];
```

The `no-restricted-syntax` rule matters because Nuxt **auto-imports** `ref`/`computed`/etc. — a logic file can use them with no import statement at all, so an import-only guard would miss them.

Verify the guard fires before relying on it: temporarily add `import { ref } from 'vue'` (and a `ref(0)` call) to a logic file, run the app's lint script (e.g. `pnpm -C app lint`), confirm both rules error, then revert.

## Component-Mount Test

Unit-testing the pure functions proves the decisions are right. It does **not** prove the `.vue` actually routes its rendering through them — a template can hardcode options or duplicate a condition and drift from the logic it's supposed to obey. Close that gap with **one** component-mount test using `@vue/test-utils`. The goal is to catch template-vs-logic drift, not to re-test the pure functions.

```typescript
// __tests__/ApprovalPopover.test.ts
import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import ApprovalPopover from '../ApprovalPopover.vue';
import { availableStates, canSave } from '../approvalPopover.logic';

describe('ApprovalPopover (template ↔ logic wiring)', () => {
  const tile = { type: 'REVIEW', status: 'READY_FOR_REVIEW', openFindings: 2 };

  it('renders exactly the options availableStates() allows', () => {
    const wrapper = mount(ApprovalPopover, { props: { tile } });
    const rendered = wrapper.findAll('[data-state-option]').map((o) => o.attributes('data-value'));
    expect(rendered).toEqual(availableStates(tile));
  });

  it('disables Save exactly when canSave() is false', () => {
    // Approve is blocked while findings are open.
    const wrapper = mount(ApprovalPopover, { props: { tile, target: 'APPROVED', comment: '' } });
    const save = wrapper.get('[data-save]');
    expect(save.attributes('disabled') !== undefined).toBe(!canSave({ tile, target: 'APPROVED', comment: '' }));
  });
});
```

Assert the rendered options match `availableStates(...)` and that Save is disabled *exactly* when `canSave(...)` is false (e.g. Approve blocked by open findings; a comment-required state with an empty comment). Place the test in the component's existing `__tests__/` directory, following local test idioms.

## When Not to Extract

Extraction is a tool for taming decisions, not a reflex. Review each logic file by asking: *is there branching of consequence here?*

- **Strong — keep extracted:** state-transition tables, backend mirrors, anything with multiple branches or a lookup the backend also owns. These earn their file and their unit test.
- **Marginal — consider inlining:** files that are only small formatters with no branching (a date pill, a one-field label). Inlining is simpler and the extraction buys no testability.

A `*.logic.ts` with no `if`/`switch`/lookup is usually a sign the logic should have stayed in the `.vue`.

## What's Next?

- [Nuxt Standards](/standards/nuxt) — auto-imports, Provider pattern, composables vs. stores
- [TypeScript Standards](/standards/typescript) — general purity and typing rules
