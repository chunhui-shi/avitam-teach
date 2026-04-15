# Chapter 10 Research Samples

This directory captures raw artifacts from the Chapter 10 research — the chapter on the meta-skill of working with AI at scale, grounded in the avitam-teach spine project.

Each subagent run that built part of the spine produced reusable evidence about how AI tools behave in practice when given a precise specification. These artifacts are **working research**, not manuscript material — they are the source a Ch 10 drafting session reads to extract concrete examples and specific data points. Quoting or paraphrasing selected passages in the book itself is fine; publishing the full transcripts is not the intent.

## What each file contains

- **`v1-prompt.md`** — the verbatim spec given to the v1-tested subagent (2026-04-15). A concrete worked example of *precise specification quality* and *context provision* — two of Chapter 10's "four levers" — at ~1,500 words. Shows what a complete, unambiguous task spec for a test-writing agent looks like.
- **`v1-subagent-report.md`** — the subagent's full self-report when v1-tested landed. Includes its non-obvious engineering decisions and, critically, an honest self-report on whether `CLAUDE.md` helped it (*"clear time-saver"*, two specific wins, and one factual correction the subagent made to the context file). This is the single strongest piece of evidence for the Chapter 10 context-engineering argument produced by this research round.

## What Chapter 10 can take from these

Three specific teaching moments already live in this data:

1. **Context files can be wrong, and disciplined agents correct them.** The v1 subagent found that `CLAUDE.md` claimed `jose` for JWT signing when the code actually used `jsonwebtoken`, and corrected both the test code and the context file. Same failure mode as comment drift in Chapter 5, at the file level.

2. **Context files prevent wrong "fixes."** The subagent explicitly reported that without `CLAUDE.md`'s "Known Issues" list it would have "fixed" the `code_solution` leak on sight, which would have broken the Chapter 6 teaching arc. This is a concrete ROI story: *the context file did not make the agent faster; it prevented an error the agent would not have recognized as an error.*

3. **Pattern recognition transfers from the reader to the writer.** The route-shape convention in `CLAUDE.md` let the subagent predict the structure of each file before reading it, and treat deviations (the progress route missing the enrollment check) as signals rather than noise. Same mental model as Chapter 5's "reading what isn't there," delivered through a context file rather than through the reader's memory.

## How these files are used

When the Chapter 10 drafting session reads this directory, the goal is to extract **three-to-five concrete sentences per chapter beat**, not to paraphrase the whole transcript. The draft gets stronger because the examples are specific and real; the research log stays in place as the durable reference.

**Do not publish the raw files.** Use them to ground prose, quote specific lines where a quote is uniquely good, and otherwise paraphrase.
