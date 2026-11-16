import html
import re
from typing import Dict, List

URL_PATTERN = re.compile(
    r"(https?://\S+|www\.\S+|\b[a-z0-9.-]+\.(?:com|net|org|info|biz|xyz|shop|click|co|top)\b(?:/\S*)?)",
    re.IGNORECASE,
)
EMAIL_PATTERN = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE_PATTERN = re.compile(r"(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}")
HTML_TAG_PATTERN = re.compile(r"<[^>]+>")
EXCLAIM_BURST_PATTERN = re.compile(r"!{2,}")
CURRENCY_PATTERN = re.compile(r"[$€£]\s?\d+(?:[.,]\d+)?")
PERCENT_PATTERN = re.compile(r"\b\d{2,3}\s?%")
WHITESPACE_PATTERN = re.compile(r"\s+")
NON_WORD_PATTERN = re.compile(r"[^a-z0-9_\s']")

# Preserve negations explicitly — never remove these words during preprocessing
NEGATION_WORDS = {
    "no",
    "not",
    "nor",
    "never",
    "neither",
    "none",
    "nothing",
    "nowhere",
    "hardly",
    "barely",
    "scarcely",
    "don't",
    "doesn't",
    "didn't",
    "won't",
    "wouldn't",
    "can't",
    "cannot",
    "couldn't",
    "shouldn't",
    "isn't",
    "aren't",
    "wasn't",
    "weren't",
    "haven't",
    "hasn't",
    "hadn't",
}

CONTRACTIONS = {
    "don't": "do not",
    "doesn't": "does not",
    "didn't": "did not",
    "won't": "will not",
    "wouldn't": "would not",
    "can't": "can not",
    "cannot": "can not",
    "couldn't": "could not",
    "shouldn't": "should not",
    "isn't": "is not",
    "aren't": "are not",
    "wasn't": "was not",
    "weren't": "were not",
    "haven't": "have not",
    "hasn't": "has not",
    "hadn't": "had not",
    "it's": "it is",
    "i'm": "i am",
    "you're": "you are",
    "they're": "they are",
    "we're": "we are",
}


def inspect_text_signals(raw_text: str) -> Dict[str, object]:
    """Extract measurable structural & lexical indicators from raw review text."""
    text = raw_text or ""
    alpha_chars = [c for c in text if c.isalpha()]
    upper_chars = [c for c in alpha_chars if c.isupper()]
    uppercase_ratio = (len(upper_chars) / len(alpha_chars)) if alpha_chars else 0.0

    urls = URL_PATTERN.findall(text)
    emails = EMAIL_PATTERN.findall(text)
    phones = PHONE_PATTERN.findall(text)
    exclaim_count = text.count("!")
    currencies = CURRENCY_PATTERN.findall(text)
    percents = PERCENT_PATTERN.findall(text)

    lowered = text.lower()
    negations_found = [
        word for word in re.findall(r"[a-z']+", lowered) if word in NEGATION_WORDS
    ]

    return {
        "char_count": len(text),
        "word_count": len(text.split()),
        "uppercase_ratio": round(uppercase_ratio, 3),
        "url_count": len(urls),
        "email_count": len(emails),
        "phone_count": len(phones),
        "exclamation_count": exclaim_count,
        "currency_mentions": len(currencies),
        "percent_mentions": len(percents),
        "negations_preserved": sorted(set(negations_found)),
    }


def preprocess_text(raw_text: str) -> str:
    """
    Consistent NLP preprocessing shared by training and inference:
    - HTML unescape & tag stripping
    - Preserve high-signal spam tokens (__URL__, __EMAIL__, __PHONE__, __MONEY__, __PERCENT__, __EXCLAIM__, __ALLCAPS__)
    - Lowercase conversion & contraction expansion preserving negations
    - Noise removal & whitespace normalization
    """
    if not isinstance(raw_text, str):
        return ""

    text = html.unescape(raw_text)
    text = HTML_TAG_PATTERN.sub(" ", text)

    # Track strong structural spam indicators before lowercasing / punctuation cleanup
    alpha_chars = [c for c in text if c.isalpha()]
    upper_ratio = (
        sum(1 for c in alpha_chars if c.isupper()) / len(alpha_chars)
        if alpha_chars
        else 0.0
    )
    extra_tokens: List[str] = []
    if len(alpha_chars) >= 10 and upper_ratio >= 0.45:
        extra_tokens.append("tok_high_caps")
    if EXCLAIM_BURST_PATTERN.search(text) or text.count("!") >= 3:
        extra_tokens.append("tok_exclaim_burst")

    text = URL_PATTERN.sub(" tok_url ", text)
    text = EMAIL_PATTERN.sub(" tok_email ", text)
    text = PHONE_PATTERN.sub(" tok_phone ", text)
    text = CURRENCY_PATTERN.sub(" tok_money ", text)
    text = PERCENT_PATTERN.sub(" tok_percent ", text)
    text = EXCLAIM_BURST_PATTERN.sub(" tok_exclaim_burst ", text)

    text = text.lower()

    for contraction, expanded in CONTRACTIONS.items():
        text = re.sub(rf"\b{re.escape(contraction)}\b", expanded, text)

    text = NON_WORD_PATTERN.sub(" ", text)
    text = text.replace("'", "")
    text = WHITESPACE_PATTERN.sub(" ", text).strip()

    if extra_tokens:
        text = f"{text} {' '.join(extra_tokens)}".strip()

    return text
