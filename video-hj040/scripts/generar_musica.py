"""
Genera una pista de hard rock ORIGINAL (instrumental, 120 BPM, 44 s) para el
video del HJ-040. Todo se sintetiza desde cero: guitarras con Karplus-Strong +
distorsión de amplificador, bajo, batería y reverb de sala.

No contiene ninguna grabación ni melodía de AC/DC: es un riff propio con el
"sabor" de rock de los 70-80 (power chords, palm mute, batería directa).

Uso:
    python3 scripts/generar_musica.py

Requisitos: numpy y scipy.
Salida: public/musica/rock-original-hj040.wav (estéreo, 44.1 kHz, 16 bits)

El tempo está amarrado al video: 120 BPM -> 1 compás = 2 s = 60 cuadros a 30 fps.
"""

from __future__ import annotations

import os

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

SR = 44100
BPM = 120
BEAT = 60 / BPM  # 0.5 s
EIGHTH = BEAT / 2  # 0.25 s
BAR = BEAT * 4  # 2 s
TOTAL_BARS = 22
DURATION = TOTAL_BARS * BAR  # 44 s
N = int(DURATION * SR)

rng = np.random.default_rng(40)  # HJ-040


# --------------------------------------------------------------------------
# Utilidades
# --------------------------------------------------------------------------
def hp(x, f, order=2):
    return sosfilt(butter(order, f, "highpass", fs=SR, output="sos"), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, "lowpass", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "bandpass", fs=SR, output="sos"), x)


def add(track, start_s, sig, gain=1.0):
    i = int(round(start_s * SR))
    if i >= len(track):
        return
    end = min(len(track), i + len(sig))
    track[i:end] += sig[: end - i] * gain


def note_hz(name: str) -> float:
    names = {"C": -9, "C#": -8, "D": -7, "D#": -6, "E": -5, "F": -4, "F#": -3,
             "G": -2, "G#": -1, "A": 0, "A#": 1, "B": 2}
    pitch, octave = name[:-1], int(name[-1])
    semis = names[pitch] + (octave - 4) * 12
    return 440.0 * 2 ** (semis / 12)


# --------------------------------------------------------------------------
# Guitarra: Karplus-Strong con retardo fraccional (afinación exacta)
# --------------------------------------------------------------------------
def pluck(freq, dur, decay=0.996, brightness=0.55, seed=0):
    r = np.random.default_rng(seed)
    n = int(dur * SR)
    period = SR / freq
    d = int(period)
    frac = period - d
    # y[0] es una muestra de silencio previa, para que y[n-d-1] siempre exista
    y = np.zeros(n + 1)
    burst = r.uniform(-1, 1, d)
    # Ataque de púa: ruido algo filtrado
    b = np.empty_like(burst)
    acc = 0.0
    for i, v in enumerate(burst):
        acc = acc + brightness * (v - acc)
        b[i] = acc
    y[1: d + 1] = b
    w0, w1 = decay * (1 - frac), decay * frac
    k = d + 1
    while k < n + 1:
        end = min(k + d, n + 1)
        ln = end - k
        y[k:end] = w0 * y[k - d: k - d + ln] + w1 * y[k - d - 1: k - d - 1 + ln]
        k = end
    return y[1:]


POWER = {
    "A5": ["A2", "E3", "A3"],
    "C5": ["C3", "G3", "C4"],
    "D5": ["D3", "A3", "D4"],
    "G5": ["G2", "D3", "G3"],
    "E5": ["E2", "B2", "E3"],
}
ROOT_BASS = {"A5": "A1", "C5": "C2", "D5": "D2", "G5": "G1", "E5": "E1"}


def chord(name, dur, muted=False, detune_cents=0.0, seed=0):
    notes = POWER[name][:2] if muted else POWER[name]
    out = np.zeros(int((dur + 0.05) * SR))
    for s, nm in enumerate(notes):
        f = note_hz(nm) * 2 ** (detune_cents / 1200)
        strum = s * (0.004 if muted else 0.009)  # rasgueo hacia abajo
        tone = pluck(f, dur, decay=0.985 if muted else 0.9975,
                     brightness=0.35 if muted else 0.6, seed=seed * 7 + s)
        if muted:
            t = np.arange(len(tone)) / SR
            tone *= np.exp(-t * 14)
        add(out, strum, tone, 1.0)
    # apagado suave al final (el guitarrista silencia las cuerdas)
    fade = int(0.012 * SR)
    end = int(dur * SR)
    out[end - fade: end] *= np.linspace(1, 0, fade)
    out[end:] = 0
    return out


def amp(di, gain=7.0):
    """Cadena de amplificador: tight -> saturación asimétrica -> gabinete."""
    x = hp(di, 110)
    x = x / (np.max(np.abs(x)) + 1e-9)
    bias = 0.15
    x = np.tanh(gain * x + bias) - np.tanh(bias)
    x = hp(x, 85)
    x = lp(x, 4300, order=4)
    # leve "presencia" de gabinete 4x12
    x = x + 0.35 * bp(x, 1400, 2600)
    return x / (np.max(np.abs(x)) + 1e-9)


# --------------------------------------------------------------------------
# Partitura (en corcheas: 8 por compás)
# --------------------------------------------------------------------------
# Riff principal (2 compases). (paso, acorde, duración en corcheas, apagado)
RIFF = [
    (0, "A5", 2, False), (2, "A5", 1, True), (3, "A5", 1, True),
    (4, "C5", 1, False), (5, "D5", 2, False), (7, "A5", 1, True),
    (8, "A5", 2, False), (10, "A5", 1, True), (11, "A5", 1, True),
    (12, "G5", 1, False), (13, "A5", 1, False), (14, "C5", 1, False),
    (15, "D5", 1, False),
]

# Coro: acordes grandes con síncopa (4 compases)
CHORUS_CHORDS = ["D5", "A5", "G5", "D5", "D5", "A5", "G5", "E5"]


def build_events():
    """Devuelve lista de (inicio_s, acorde, dur_s, apagado, guitarras)."""
    ev = []
    # Intro: compases 0-3 (guitarra izquierda sola en 0-1, ambas en 2-3)
    for rep, bar0 in enumerate([0, 2]):
        for step, ch, ln, mute in RIFF:
            ev.append((bar0 * BAR + step * EIGHTH, ch, ln * EIGHTH, mute,
                       "L" if rep == 0 else "LR"))
    # Estrofa: compases 4-15 -> riff x6
    for bar0 in range(4, 16, 2):
        for step, ch, ln, mute in RIFF:
            ev.append((bar0 * BAR + step * EIGHTH, ch, ln * EIGHTH, mute, "LR"))
    # Coro: compases 16-19
    for i, ch in enumerate(CHORUS_CHORDS):
        t0 = 16 * BAR + i * 2 * BEAT
        ev.append((t0, ch, 3 * EIGHTH, False, "LR"))
        ev.append((t0 + 3 * EIGHTH, ch, 1 * EIGHTH, False, "LR"))
    # Golpe final: compás 20 (dejar sonar)
    ev.append((20 * BAR, "A5", 2 * BAR - 0.05, False, "LR"))
    return ev


# --------------------------------------------------------------------------
# Batería
# --------------------------------------------------------------------------
def kick():
    t = np.arange(int(0.45 * SR)) / SR
    f = 48 + 95 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 8)
    click = hp(rng.uniform(-1, 1, len(t)), 2500) * np.exp(-t * 400) * 0.5
    return np.tanh(1.8 * (body + click)) * 0.95


def snare():
    t = np.arange(int(0.35 * SR)) / SR
    body = (np.sin(2 * np.pi * 185 * t) + 0.5 * np.sin(2 * np.pi * 330 * t)) * np.exp(-t * 28)
    noise = bp(rng.uniform(-1, 1, len(t)), 1200, 9000) * np.exp(-t * 15)
    return np.tanh(1.4 * (0.55 * body + 1.1 * noise)) * 0.8


def hat(open_=False):
    ln = 0.35 if open_ else 0.07
    t = np.arange(int(ln * SR)) / SR
    x = hp(rng.uniform(-1, 1, len(t)), 7000, order=4)
    return x * np.exp(-t * (9 if open_ else 70)) * 0.35


def crash():
    t = np.arange(int(3.0 * SR)) / SR
    x = hp(rng.uniform(-1, 1, len(t)), 3500, order=2)
    metal = sum(np.sign(np.sin(2 * np.pi * f * t)) for f in (421, 587, 793, 1103)) * 0.04
    return (x + hp(metal, 2000)) * np.exp(-t * 1.6) * 0.45


KICK, SNARE, HAT_C, HAT_O, CRASH = kick(), snare(), hat(), hat(True), crash()


def drums(dr_l, dr_r):
    def both(t, s, g=1.0, pan=0.0):
        add(dr_l, t, s, g * (1 - max(pan, 0)))
        add(dr_r, t, s, g * (1 + min(pan, 0)))

    # Intro: hi-hats en compás 2-3, conteo y redoble al final del compás 3
    for bar in (2, 3):
        for e in range(8):
            both(bar * BAR + e * EIGHTH, HAT_C, 0.5 + 0.1 * bar, pan=0.3)
    both(3 * BAR, KICK, 0.8)
    both(3 * BAR + 2 * BEAT, KICK, 0.8)
    for i in range(4):  # redoble en semicorcheas, tiempo 4
        both(3 * BAR + 3 * BEAT + i * EIGHTH / 2, SNARE, 0.45 + 0.15 * i)

    # Estrofa (4-15) y coro (16-19)
    for bar in range(4, 20):
        b0 = bar * BAR
        chorus = bar >= 16
        if bar in (4, 8, 12, 16, 17, 18, 19):
            both(b0, CRASH, 0.9 if bar in (4, 16) else 0.6)
        for e in range(8):
            if chorus:
                both(b0 + e * EIGHTH, HAT_O if e % 2 == 1 else HAT_C, 0.45, pan=0.3)
            else:
                both(b0 + e * EIGHTH, HAT_C, 0.75 if e % 2 == 0 else 0.5, pan=0.3)
        kicks = [0, 2] + ([2.5] if chorus else [])
        last_bar_of_section = bar in (15, 19)
        for k in kicks:
            both(b0 + k * BEAT, KICK, 1.0)
        both(b0 + 1 * BEAT, SNARE, 1.0)
        if last_bar_of_section:
            for i in range(4):
                both(b0 + 3 * BEAT + i * EIGHTH / 2, SNARE, 0.6 + 0.13 * i)
        else:
            both(b0 + 3 * BEAT, SNARE, 1.0)

    # Final
    both(20 * BAR, KICK, 1.1)
    both(20 * BAR, CRASH, 1.0)
    both(20 * BAR, SNARE, 0.7)


# --------------------------------------------------------------------------
# Bajo
# --------------------------------------------------------------------------
def bass_note(name, dur):
    f = note_hz(name)
    t = np.arange(int(dur * SR)) / SR
    saw = 2 * ((t * f) % 1) - 1
    sub = np.sin(2 * np.pi * f * t)
    x = 0.6 * saw + 0.6 * sub
    x = lp(x, 900)
    env = np.minimum(1, t / 0.004) * np.exp(-t * 2.2)
    rel = int(0.01 * SR)
    env[-rel:] *= np.linspace(1, 0, rel)
    return np.tanh(1.6 * x * env)


def bassline(bass, events):
    # La línea sigue la nota raíz del acorde que suena en cada corchea.
    timeline = sorted((e for e in events if e[0] >= 4 * BAR), key=lambda e: e[0])
    for bar in range(4, 20):
        for e in range(8):
            t = bar * BAR + e * EIGHTH
            current = [ev for ev in timeline if ev[0] <= t + 1e-6]
            ch = current[-1][1] if current else "A5"
            add(bass, t, bass_note(ROOT_BASS[ch], EIGHTH * 0.95), 0.9)
    add(bass, 20 * BAR, bass_note("A1", 2 * BAR - 0.1), 1.0)


# --------------------------------------------------------------------------
# Mezcla
# --------------------------------------------------------------------------
def room_ir(length=1.4, decay=0.32):
    t = np.arange(int(length * SR)) / SR
    ir = rng.uniform(-1, 1, len(t)) * np.exp(-t / decay)
    ir = lp(ir, 6000)
    ir[: int(0.012 * SR)] = 0  # pre-delay
    return ir / np.sqrt(np.sum(ir ** 2))


def main():
    events = build_events()

    di_l = np.zeros(N)
    di_r = np.zeros(N)
    for i, (t, ch, dur, mute, sides) in enumerate(events):
        if "L" in sides:
            add(di_l, t, chord(ch, dur, mute, detune_cents=-4, seed=i))
        if "R" in sides:
            add(di_r, t + 0.011, chord(ch, dur, mute, detune_cents=+5, seed=i + 999))

    gtr_l = amp(di_l)
    gtr_r = amp(di_r) if np.any(di_r) else di_r

    dr_l, dr_r = np.zeros(N), np.zeros(N)
    drums(dr_l, dr_r)

    bass = np.zeros(N)
    bassline(bass, events)

    # Final: el acorde y el bajo se desvanecen en los últimos 3 s
    t = np.arange(N) / SR
    fade = np.clip((DURATION - t) / 3.2, 0, 1) ** 1.5
    fade = np.where(t < 20 * BAR, 1.0, fade)
    gtr_l, gtr_r, bass = gtr_l * fade, gtr_r * fade, bass * fade

    left = 0.62 * gtr_l + 0.18 * gtr_r + 0.55 * bass + 0.8 * dr_l
    right = 0.18 * gtr_l + 0.62 * gtr_r + 0.55 * bass + 0.8 * dr_r

    # Dos respuestas de sala distintas -> reverb estéreo decorrelacionada
    rev_l = fftconvolve(left, room_ir())[:N]
    rev_r = fftconvolve(right, room_ir())[:N]
    left = left + 0.18 * rev_l
    right = right + 0.18 * rev_r

    mix = np.stack([left, right], axis=1)
    mix = mix / (np.max(np.abs(mix)) + 1e-9)
    mix = np.tanh(1.5 * mix) / np.tanh(1.5)  # "pegamento" de bus / limitador suave
    mix *= 10 ** (-1 / 20)  # pico a -1 dBFS

    # micro fade-in / fade-out para evitar clics
    f_in = int(0.005 * SR)
    mix[:f_in] *= np.linspace(0, 1, f_in)[:, None]
    mix[-f_in:] *= np.linspace(1, 0, f_in)[:, None]

    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.join(here, "..", "public", "musica")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "rock-original-hj040.wav")
    wavfile.write(out, SR, (mix * 32767).astype(np.int16))
    print(f"OK -> {os.path.normpath(out)}  ({DURATION:.1f} s)")


if __name__ == "__main__":
    main()
