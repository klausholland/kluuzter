import { describe, it, expect } from "vitest";
import { createActor } from "xstate";
import { gameMachine } from "../machine";
import type { Card, GameInput } from "../types";

function card(id: string, year: number): Card {
  return {
    id,
    uri: `spotify:track:${id}`,
    title: `t-${id}`,
    artist: `a-${id}`,
    year,
    yearSource: "musicbrainz",
    coverUrl: null,
  };
}

// Deck: erst Anker (1 pro Spieler), dann Mystery-Karten in Ziehreihenfolge.
function soloInput(): GameInput {
  return {
    players: [{ id: "A", name: "Anna" }],
    mode: "targetCards",
    targetValue: 3,
    startTokens: 2,
    deck: [
      card("anchorA", 1980), // Anker A
      card("m1", 1970), // 1. Mystery (gehört vor 1980 → Slot 0)
      card("m2", 1990), // 2. Mystery
      card("m3", 2000), // Reserve
    ],
  };
}

function start(input: GameInput) {
  const actor = createActor(gameMachine, { input });
  actor.start();
  return actor;
}

describe("dealing", () => {
  it("deals one anchor per player and draws the first mystery card", () => {
    const actor = start(soloInput());
    const s = actor.getSnapshot();
    expect(s.value).toBe("playing");
    expect(s.context.players[0].timeline.map((c) => c.id)).toEqual(["anchorA"]);
    expect(s.context.currentCard?.id).toBe("m1");
  });
});

describe("solo turn (no countering)", () => {
  it("goes playing → reveal on PLACE (skips countering for 1 player)", () => {
    const actor = start(soloInput());
    actor.send({ type: "PLACE", slot: 0 }); // 1970 vor 1980 → korrekt
    const s = actor.getSnapshot();
    expect(s.value).toBe("reveal");
    expect(s.context.resolution?.winnerId).toBe("A");
  });

  it("CONTINUE applies a token claim and starts the next turn", () => {
    const actor = start(soloInput());
    actor.send({ type: "PLACE", slot: 0 });
    actor.send({ type: "CONTINUE", claimedCorrect: true });
    const s = actor.getSnapshot();
    expect(s.context.players[0].tokens).toBe(3); // 2 + 1
    expect(s.value).toBe("playing");
    expect(s.context.currentCard?.id).toBe("m2");
    // A hat jetzt 1 gewertete Karte (m1) + Anker
    expect(s.context.players[0].timeline.length).toBe(2);
  });

  it("reaches gameOver when the card target is met", () => {
    const actor = start(soloInput()); // targetValue 3
    // Zug 1: m1 (1970) vor Anker 1980 → Slot 0 korrekt
    actor.send({ type: "PLACE", slot: 0 });
    actor.send({ type: "CONTINUE", claimedCorrect: false });
    // Zug 2: m2 (1990); Timeline [1970,1980] → Slot 2 (nach 1980) korrekt
    actor.send({ type: "PLACE", slot: 2 });
    actor.send({ type: "CONTINUE", claimedCorrect: false });
    const s = actor.getSnapshot();
    expect(s.value).toBe("gameOver");
    expect(s.context.winnerId).toBe("A");
    expect(s.status).toBe("done");
  });
});

describe("skip (unplayable track)", () => {
  it("draws a new card for the same player without advancing the turn", () => {
    const actor = start(soloInput());
    expect(actor.getSnapshot().context.currentCard?.id).toBe("m1");
    actor.send({ type: "SKIP" });
    const s = actor.getSnapshot();
    expect(s.value).toBe("playing");
    expect(s.context.currentCard?.id).toBe("m2"); // nächste Karte
    expect(s.context.activeIndex).toBe(0); // gleicher Spieler
    expect(s.context.turnsThisRound).toBe(0); // kein Zug verbraucht
  });
});

describe("two-player turn (countering)", () => {
  function duoInput(): GameInput {
    return {
      players: [
        { id: "A", name: "Anna" },
        { id: "B", name: "Ben" },
      ],
      mode: "targetCards",
      targetValue: 10,
      startTokens: 2,
      deck: [
        card("anchorA", 1980),
        card("anchorB", 1995),
        card("m1", 1970), // Mystery für A; A-Timeline [1980] → Slot 0 korrekt
        card("m2", 2010),
        card("m3", 1960),
      ],
    };
  }

  it("enters countering after PLACE and lets B counter, then reveals", () => {
    const actor = start(duoInput());
    actor.send({ type: "PLACE", slot: 1 }); // falsch: 1970 nicht nach 1980
    expect(actor.getSnapshot().value).toBe("countering");
    expect(actor.getSnapshot().context.pendingCounterIds).toEqual(["B"]);

    actor.send({ type: "COUNTER", slot: 0 }); // B: 1970 vor 1980 → korrekt
    const s = actor.getSnapshot();
    expect(s.value).toBe("reveal");
    expect(s.context.resolution?.winnerId).toBe("B");
    // B hat einen Token ausgegeben
    expect(s.context.players.find((p) => p.id === "B")!.tokens).toBe(1);
  });

  it("PASS skips the counter and reveals with discard if active was wrong", () => {
    const actor = start(duoInput());
    actor.send({ type: "PLACE", slot: 1 }); // A falsch
    actor.send({ type: "PASS" });
    const s = actor.getSnapshot();
    expect(s.value).toBe("reveal");
    expect(s.context.resolution?.winnerId).toBeNull();
  });

  it("rotates the active player and counts rounds after CONTINUE", () => {
    const actor = start(duoInput());
    actor.send({ type: "PLACE", slot: 0 }); // A korrekt
    actor.send({ type: "PASS" }); // B kontert nicht
    actor.send({ type: "CONTINUE", claimedCorrect: false });
    const s = actor.getSnapshot();
    expect(s.value).toBe("playing");
    expect(s.context.activeIndex).toBe(1); // jetzt B am Zug
    expect(s.context.turnsThisRound).toBe(1);
    expect(s.context.currentCard?.id).toBe("m2");
  });
});

describe("counter guard", () => {
  it("ignores a COUNTER from a player without tokens", () => {
    const input: GameInput = {
      players: [
        { id: "A", name: "A" },
        { id: "B", name: "B" },
      ],
      mode: "targetCards",
      targetValue: 10,
      startTokens: 0, // niemand hat Token
      deck: [card("anchorA", 1980), card("anchorB", 1995), card("m1", 1970), card("x", 2001)],
    };
    const actor = start(input);
    actor.send({ type: "PLACE", slot: 1 });
    actor.send({ type: "COUNTER", slot: 0 }); // ungültig (kein Token)
    // Queue unverändert, weiterhin in countering
    expect(actor.getSnapshot().value).toBe("countering");
    expect(actor.getSnapshot().context.counters).toEqual([]);
  });
});
