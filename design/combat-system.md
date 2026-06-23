# Ashen — Combat System

> Design note / shareable explainer. This is the player-facing combat philosophy for
> the Dark Souls III one-shot. The mechanical implementation lives in the **Soulslike
> Rules** journal (compendium `journals-rules`).

## TL;DR

Dark Souls defense in D&D. When an enemy attacks, you choose **Dodge, Block, or
Parry** *and* which of the move's **3 timing windows** (wind-up / commit / impact)
you react in. Every move has a hidden "right answer" grid — read it right and you
roll with **advantage**, guess wrong and you roll with **disadvantage**.

The twist: the defensive roll is **flat — no stats added.** Only your *timing read*
matters. It's skill, not numbers — "get gud" at the table. Stats just give you tools
(more reactions, guard-break resistance), never the result.

**Dodge** is free and unlimited (success = no damage + reposition for a backstab).
**Block** spends your reaction and leans on your shield. **Parry** spends your
reaction, is brutally narrow (one window only), but negates the hit *and* staggers
the enemy for a party-wide riposte. Some moves can't be blocked/dodged/parried at all.

Mooks have 1 move (solve it instantly). Bosses have 4–6 (the real puzzle). You learn
movesets by fighting — and dying. Die, learn, overcome.

## The core idea: windowed defense

Every enemy attack plays out across **3 windows**:

- **W1 — wind-up** (the telegraph)
- **W2 — commit** (the swing is mid-motion)
- **W3 — impact** (it lands)

When you're targeted, you pick **a defense + a window**: *"Dodge on W2,"* *"Parry on
W3,"* *"Block."*

Each move has a hidden **Defensive Profile** — a 3×3 grid (Dodge / Block / Parry ×
W1 / W2 / W3) where each cell is **advantage / normal / disadvantage / impossible**.
Reading the move correctly = advantage. Guessing wrong = disadvantage. **Figuring out
the grid is the puzzle.**

## "Get gud, not stats"

The defensive d20 is rolled **flat — no ability modifier.** The *only* thing that
swings the roll is your window read. A clumsy character who reads the tell beats a
nimble one who panics. Stats give you **tools, not results** (more reactions,
guard-break resistance, passive AC for when you *don't* react) — they never roll the
dodge for you.

## The three defenses

- **Dodge** — always free, unlimited. Flat d20 vs the move's Dodge DC. Success = no
  damage + reposition 5 ft; end up *behind* the enemy and your next attack gets
  advantage (footwork → backstabs). The staple.
- **Block** — costs your reaction, no roll. A good shield negates physical damage, but
  heavy/charging moves force a Strength save vs guard-break. Lesser shields just halve
  + chip. Some moves are unblockable.
- **Parry** — costs your reaction. Flat d20, but **only one window gives advantage;
  every other window is disadvantage.** Success = negate the hit *and* stagger the
  enemy (it loses its next action + opens a party-wide riposte). Fail = full damage,
  no reduction. High risk, high reward — and only clean weapon swings can be parried.

## Reaction economy (this is what pushes dodging)

Dodge is free every turn. Block and Parry cost your one reaction per round.
Endurance/Poise points buy *extra* reactions — so investing in defense literally lets
you do more of it.

## Scales from mooks to bosses

Same system everywhere, just different move counts:

- **Regular enemy** = **1 move** (one card; solved in a hit or two — fast fights, and
  free practice).
- **Mini-boss** = 2–3 moves.
- **Boss** = 4–6 moves, built from the actual DS3 moveset.

Some moves are tagged **unblockable / undodgeable / unparryable** to keep players
honest (grabs, magic, charges).

## How players learn it

Each boss has a **Tell Ladder** — a prepared sequence of escalating hints, delivered
in-fiction. Every time the party wipes, they get the next rung (e.g. *"his overhead
leaves him open right as it lands"*). Knowledge is the upgrade — no power creep, just
understanding. Die, learn, overcome.
