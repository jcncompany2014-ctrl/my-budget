'use client';

import type { Scope, Transaction } from '@/lib/types';

/**
 * Multinomial Naive Bayes classifier for merchant → category.
 *
 * Why this and not a heavyweight ML library:
 *   • 0 bytes download — the model is the user's own transaction history.
 *   • <5ms training on 1k transactions, <1ms classification per merchant.
 *   • Proper probabilistic learning instead of frequency heuristics, so an
 *     unseen merchant like "스타벅스 종로점" still maps to 'cafe' if the
 *     user has logged "스타벅스 강남점" / "스타벅스 신촌점" before — the
 *     shared tokens carry the signal.
 *   • Privacy: never leaves the device.
 *
 * Tokenization is intentionally simple — whitespace splits + character
 * bigrams. Korean morphological analyzers (mecab-ko etc.) would be more
 * accurate but pull in megabytes of dictionary; bigrams capture enough
 * subword signal for merchant names without the bundle cost.
 */

export type BayesModel = {
  /** cat → number of training docs */
  docCount: Map<string, number>;
  /** cat → word → frequency */
  wordCount: Map<string, Map<string, number>>;
  /** cat → total word occurrences (sum of wordCount values) */
  totalWordsByCat: Map<string, number>;
  /** size of the global vocabulary (for Laplace smoothing) */
  vocabSize: number;
  /** total number of training docs */
  totalDocs: number;
};

const EMPTY_MODEL: BayesModel = {
  docCount: new Map(),
  wordCount: new Map(),
  totalWordsByCat: new Map(),
  vocabSize: 0,
  totalDocs: 0,
};

export function tokenize(text: string): string[] {
  const cleaned = text.toLowerCase().trim();
  if (!cleaned) return [];
  const out: string[] = [];
  for (const word of cleaned.split(/[\s/·,.\-_]+/)) {
    if (!word) continue;
    out.push(word);
    // Character bigrams pick up sub-string overlap between merchant variants
    // (e.g. "스타벅스 강남점" and "스타벅스 종로점" share '스타', '타벅', …).
    for (let i = 0; i < word.length - 1; i++) {
      out.push(word.slice(i, i + 2));
    }
  }
  return out;
}

export function trainBayes(history: Transaction[], scope: Scope): BayesModel {
  const docCount = new Map<string, number>();
  const wordCount = new Map<string, Map<string, number>>();
  const totalWordsByCat = new Map<string, number>();
  const vocab = new Set<string>();

  for (const t of history) {
    if ((t.scope ?? 'personal') !== scope) continue;
    const tokens = tokenize(t.merchant);
    if (tokens.length === 0) continue;
    docCount.set(t.cat, (docCount.get(t.cat) ?? 0) + 1);
    let cm = wordCount.get(t.cat);
    if (!cm) {
      cm = new Map();
      wordCount.set(t.cat, cm);
    }
    for (const w of tokens) {
      cm.set(w, (cm.get(w) ?? 0) + 1);
      vocab.add(w);
    }
    totalWordsByCat.set(t.cat, (totalWordsByCat.get(t.cat) ?? 0) + tokens.length);
  }

  let totalDocs = 0;
  docCount.forEach((c) => {
    totalDocs += c;
  });

  return { docCount, wordCount, totalWordsByCat, vocabSize: vocab.size, totalDocs };
}

/**
 * Classify a merchant string into the category whose conditional probability
 * is highest. `confidence` is the log-prob gap to the runner-up, normalized
 * to [0, 1] — caller can require a minimum to ignore weak signals.
 */
export function classifyBayes(
  text: string,
  model: BayesModel,
  validCats?: Set<string>,
): { cat: string; confidence: number } | null {
  const tokens = tokenize(text);
  if (tokens.length === 0) return null;
  if (model.totalDocs === 0) return null;

  let bestCat: string | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  let secondScore = Number.NEGATIVE_INFINITY;

  model.docCount.forEach((catDocs, cat) => {
    if (validCats && !validCats.has(cat)) return;
    let score = Math.log(catDocs / model.totalDocs);
    const totalCatWords = model.totalWordsByCat.get(cat) ?? 0;
    const cm = model.wordCount.get(cat);
    for (const w of tokens) {
      const wc = cm?.get(w) ?? 0;
      // Laplace +1 smoothing
      score += Math.log((wc + 1) / (totalCatWords + model.vocabSize + 1));
    }
    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      bestCat = cat;
    } else if (score > secondScore) {
      secondScore = score;
    }
  });

  if (bestCat === null) return null;
  const gap = secondScore === Number.NEGATIVE_INFINITY ? 5 : bestScore - secondScore;
  const confidence = Math.max(0, Math.min(1, gap / 5));
  return { cat: bestCat, confidence };
}

/**
 * Module-level cache keyed on the history array reference. React hooks
 * pass the same `history` reference until something is added/removed/edited,
 * so this avoids retraining on every keystroke during merchant entry.
 */
const cache = new WeakMap<Transaction[], Map<Scope, BayesModel>>();

export function getBayesModel(history: Transaction[], scope: Scope): BayesModel {
  if (history.length === 0) return EMPTY_MODEL;
  let perScope = cache.get(history);
  if (!perScope) {
    perScope = new Map();
    cache.set(history, perScope);
  }
  let model = perScope.get(scope);
  if (!model) {
    model = trainBayes(history, scope);
    perScope.set(scope, model);
  }
  return model;
}
