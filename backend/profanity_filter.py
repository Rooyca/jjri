from better_profanity import profanity
import unicodedata
import re

SPANISH_BAD_WORDS = [
    "puta", "puto", "mierda", "coño", "joder", "hostia", "gilipollas",
    "cabrón", "cabron", "pendejo", "chinga", "chingada", "verga", "culero",
    "maricón", "maricon", "imbécil", "imbecil", "idiota", "estúpido", "estupido",
    "hdp", "ctm", "ptm", "conchetumare", "huevón", "huevon", "gonorrea",
    "malparido", "hijueputa", "mamahuevo", "cojonudo", "carajo", "cojones",
    "estúpida", "estupida", "gey", "gay", "gei", "gai", "perro", "perra", "ijueputa",
    "jueputa", "malparida", "cacorro", "cacorra", "mamabicho", "mamavicho", "pene", "pipi",
    "mamaverga", "chimbo", "pinga", "culo", "ano", "sexo", "vagina", "anal", "porno", "homosexual",
    "travesti", "travuco", "trava", "leche"
]

USERNAME_MIN_LENGTH = 2
USERNAME_MAX_LENGTH = 20

profanity.load_censor_words(SPANISH_BAD_WORDS)

def _normalize(text: str) -> str:
    text = text.lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return text

def _word_contains_profanity(word: str) -> bool:
    normalized = _normalize(word)
    stripped = re.sub(r"[^a-z0-9]", "", normalized)
    for bad_word in SPANISH_BAD_WORDS:
        if bad_word in normalized or bad_word in stripped:
            return True
    return False

def validate_and_clean_username(text: str) -> str:
    if len(text) > USERNAME_MAX_LENGTH or len(text) < USERNAME_MIN_LENGTH: return "Anónimo"

    words = text.split(" ")
    clean_words = [word for word in words if not _word_contains_profanity(word)]
    cleaned = " ".join(clean_words).strip()

    if not cleaned:
        cleaned = "Anónimo"

    return cleaned


