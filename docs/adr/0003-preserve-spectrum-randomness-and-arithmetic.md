# Preserve Spectrum randomness and numerical behaviour

Fidelity includes the Spectrum's random-number generator and numerical behaviour: equivalent starting random state and player inputs should produce equivalent results, rather than merely similar outcome distributions. A TypeScript rebuild must therefore investigate these dependencies rather than assume JavaScript arithmetic and the existing seeded RNG are adequate substitutes.

The analysis milestone will identify relevant dependencies and flag costly compatibility work before gameplay implementation. Emulator observations will check the extracted logic against actual play, with untested paths explicitly recorded.

Analysis found frame-clock reseeding at each management cycle and random draws during highlights and goal sounds. Equivalent replays therefore require equivalent frame/input timing at reseeding points, as well as the same seed and actions. The headless simulation must preserve the logical colour attributes used by the original highlights to determine goals.
