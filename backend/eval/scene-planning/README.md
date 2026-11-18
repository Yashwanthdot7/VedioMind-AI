# Scene planning benchmark

When a lesson is made from long material (big notes, a 40-minute transcript), the script
writer can only read part of it. This folder holds a small labelled set used to measure
**which part** it should read.

Each `.json` file has:

- `text`: the material (lecture transcripts with chatter and stories, textbook notes,
  unpunctuated auto-captions, and one Hindi text)
- `keyPoints`: the 6 points a good lesson on it must cover, written by hand

Run it from `backend/`:

```bash
node scripts/compareScenePlanning.js          # offline, free, under a second
node scripts/compareScenePlanning.js --live   # also writes real lessons with Gemini (needs GEMINI_API_KEY)
node scripts/compareScenePlanning.js --write  # save the tables to RESULTS.md
```

Latest numbers: [RESULTS.md](RESULTS.md).

## Limits

- Six documents of 400 to 650 words is a small set. It shows the direction of the effect,
  not a precise size. The budget is a share of each text to stand in for much longer input.
- ROUGE recall and the 50%-of-content-words rule are word-overlap measures. They reward
  keeping the right facts, not good writing.
- The texts and key points were written for this benchmark. TextRank was not tuned on them:
  the algorithm uses the standard settings from Mihalcea and Tarau (2004), damping 0.85.
- It cannot fix material whose key points are spread thinly over many short sentences:
  "Causes of the French Revolution" shows no gain over plain truncation.
