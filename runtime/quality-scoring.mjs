/** Conservative regression scorer, not a semantic judge. Paraphrases require review. */
export function normalized(value) {
  const numbers = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  return value.toLowerCase()
    .replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[ -](one|two|three|four|five|six|seven|eight|nine)\b/g, (_, tens, units) => String(numbers[tens] + numbers[units]))
    .replace(/\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\b/g, (word) => String(numbers[word]))
    .replace(/\b(\d+(?:\.\d+)?)\s*(?:k|thousand)\b/g, (_, amount) => String(Number(amount) * 1000))
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .replace(/\bpercent\b/g, "%")
    .replace(/[^a-z0-9@.%]+/g, " ").trim().replace(/\s+/g, " ");
}

export function valuesMatch(fieldId, expected, actual, acceptedValues = []) {
  if (acceptedValues.some((value) => typeof value === "string" && valuesMatch(fieldId, value, actual))) return true;
  // Phone punctuation is presentation; country codes remain significant.
  if (fieldId === "phone") return expected.replace(/\D/g, "") === actual.replace(/\D/g, "");
  if (fieldId === "email") return expected.trim().toLowerCase() === actual.trim().toLowerCase();
  return normalized(expected) === normalized(actual);
}

/** Match only adjudicated references; an unlisted paraphrase still needs semantic review. */
export function assessReference(fieldId, expected, actual, acceptedValues = [], detailReference = expected) {
  const matched = expected === null || actual === null ? expected === actual : valuesMatch(fieldId, expected, actual, acceptedValues);
  const fullDetail = matched && (actual === null ? detailReference === null : valuesMatch(fieldId, detailReference, actual));
  return { normalized_reference_match: matched, detail_coverage: !matched ? "needs_semantic_review" : detailReference === expected ? "not_separately_scored" : fullDetail ? "full_reference" : "concise_reference" };
}
