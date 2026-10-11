"""Fabrique pupitre/assets/carillon.wav : carillon doux de 2 notes (mi 5 puis la 5), environ 0,7 s.

Bibliothèque standard seulement. Lancer depuis la racine du dépôt : python outils/carillon.py
"""
import math
import struct
import wave
from pathlib import Path

TAUX = 44100
DUREE = 0.75
NOTES = [  # (fréquence Hz, départ s, durée s)
    (659.25, 0.00, 0.45),
    (880.00, 0.18, 0.55),
]


def echantillon(t: float) -> float:
    v = 0.0
    for f, debut, duree in NOTES:
        u = t - debut
        if 0 <= u <= duree:
            attaque = min(1.0, u / 0.008)                 # 8 ms : pas de clic
            decroit = math.exp(-u * 5.5)                  # extinction douce
            onde = math.sin(2 * math.pi * f * u) + 0.25 * math.sin(2 * math.pi * 2 * f * u)
            v += 0.32 * attaque * decroit * onde
    return max(-1.0, min(1.0, v))


def main() -> None:
    cible = Path(__file__).resolve().parent.parent / "pupitre" / "assets" / "carillon.wav"
    cible.parent.mkdir(parents=True, exist_ok=True)
    n = int(TAUX * DUREE)
    with wave.open(str(cible), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(TAUX)
        w.writeframes(b"".join(struct.pack("<h", int(echantillon(i / TAUX) * 32767)) for i in range(n)))
    print(f"écrit : {cible} ({cible.stat().st_size} octets)")


if __name__ == "__main__":
    main()
