# lightningcss: minify sometimes drops a rule after merging rules

With `minify: true`, [lightningcss](https://github.com/parcel-bundler/lightningcss) (tested with 1.33.0, the latest release) occasionally deletes a style rule that follows a run of mergeable rules. It reports no error or warning. The output changes from one process to the next on identical input: roughly 0.5–1% of fresh Node processes produce the broken output.

## Input

```css
.a, .b { position: absolute; }
.a { color: red; }
.b { color: red; }
.c { position: relative; }
```

## Expected output (most runs)

```css
.a,.b{color:red;position:absolute}.c{position:relative}
```

## Actual output (~0.5–1% of processes)

```css
.a,.b{color:red;position:absolute}
```

`.c` is removed entirely, whatever declarations it contains.

## Reproduce

```sh
pnpm install
pnpm run repro       # 1000 fresh processes; or: node repro.mjs 5000
```

Example output:

```
lightningcss 1.33.0, 1000 processes

   994  .a,.b{color:red;position:absolute}.c{position:relative}
     6  .a,.b{color:red;position:absolute}   <-- .c was dropped

Non-deterministic output: reproduced.
```

`repro.mjs` runs `minify.mjs` in a new process each time. **Calling `transform()` in a loop inside one process does not reproduce the bug.** The result is stable within a process and only varies between processes, which suggests a per-process random hash seed is involved.

## Observations

- Reproduced with lightningcss 1.21.8, 1.30.2, 1.32.0 and 1.33.0.
- It happens with and without `targets`.
- It needs the double merge:
  1. `.a{Y}` and `.b{Y}` merge into `.a,.b{Y}`.
  2. That rule then merges into the preceding `.a,.b{X}`.
- With a single selector (`.a{X} .a{Y} .c{Z}`) it never reproduced in 500 runs.
- The declarations in `.c` don't matter.

## Suspected cause (from reading the source, not verified)

In `CssRuleList::minify` (`src/rules/mod.rs`), when a new style rule merges into the last rule, a `while` loop tries to merge the last rule into the one before it and calls `rules.pop()` on success. The `style_rules` map used for duplicate removal can still hold a `StyleRuleKey` for the popped index.

The next rule (`.c`) is then pushed at that same index. If its lookup in `style_rules` probes the stale entry (which depends on hash bits), the duplicate check (`is_duplicate`) compares `rules[idx]` with itself and succeeds. The new rule is then replaced with `CssRule::Ignored`, so it disappears from the output.

## Impact

In a real build this silently removed a `position: relative` rule from CSS bundles. The build exited 0 and the broken output was cached by the build system, so re-running the build didn't fix it. Rebuilding without the cache usually produced correct CSS again.
