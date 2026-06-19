import { setup, assign, assertEvent } from "xstate";
import type { GameContext, GameEvent, GameInput } from "./types";
import { evaluateTurn, applyResolution } from "./evaluate";
import { isGameOver, determineWinner } from "./win";

function initialContext(input: GameInput): GameContext {
  return {
    mode: input.mode,
    targetValue: input.targetValue,
    players: input.players.map((p) => ({
      id: p.id,
      name: p.name,
      tokens: input.startTokens,
      timeline: [],
    })),
    turnOrder: input.players.map((p) => p.id),
    activeIndex: 0,
    deck: [...input.deck],
    currentCard: null,
    placement: null,
    counters: [],
    pendingCounterIds: [],
    resolution: null,
    roundsCompleted: 0,
    turnsThisRound: 0,
    winnerId: null,
  };
}

export const gameMachine = setup({
  types: {
    context: {} as GameContext,
    events: {} as GameEvent,
    input: {} as GameInput,
  },
  actions: {
    dealAndStart: assign(({ context }) => {
      const deck = [...context.deck];
      const players = context.players.map((p) => {
        const anchor = deck.shift();
        return { ...p, timeline: anchor ? [anchor] : [] };
      });
      const currentCard = deck.shift() ?? null;
      return { deck, players, currentCard };
    }),

    recordPlacement: assign(({ context, event }) => {
      assertEvent(event, "PLACE");
      return {
        placement: {
          playerId: context.turnOrder[context.activeIndex],
          slot: event.slot,
        },
      };
    }),

    setupCounterQueue: assign(({ context }) => {
      const n = context.turnOrder.length;
      const order: string[] = [];
      for (let i = 1; i < n; i++) {
        order.push(context.turnOrder[(context.activeIndex + i) % n]);
      }
      return { pendingCounterIds: order, counters: [] };
    }),

    recordCounter: assign(({ context, event }) => {
      assertEvent(event, "COUNTER");
      const counterer = context.pendingCounterIds[0];
      return {
        players: context.players.map((p) =>
          p.id === counterer ? { ...p, tokens: p.tokens - 1 } : p,
        ),
        counters: [...context.counters, { playerId: counterer, slot: event.slot }],
        pendingCounterIds: context.pendingCounterIds.slice(1),
      };
    }),

    skipCounter: assign(({ context }) => ({
      pendingCounterIds: context.pendingCounterIds.slice(1),
    })),

    evaluate: assign(({ context }) => {
      const active = context.players[context.activeIndex];
      const card = context.currentCard!;
      const resolution = evaluateTurn(
        active.timeline,
        context.placement!.slot,
        context.counters,
        card,
        active.id,
      );
      return {
        resolution,
        players: applyResolution(context.players, resolution),
      };
    }),

    applyTokenClaim: assign(({ context, event }) => {
      assertEvent(event, "CONTINUE");
      if (!event.claimedCorrect) return {};
      const activeId = context.turnOrder[context.activeIndex];
      return {
        players: context.players.map((p) =>
          p.id === activeId ? { ...p, tokens: p.tokens + 1 } : p,
        ),
      };
    }),

    advanceTurn: assign(({ context }) => {
      const turnsThisRound = context.turnsThisRound + 1;
      const completedRound = turnsThisRound >= context.turnOrder.length;
      return {
        activeIndex: (context.activeIndex + 1) % context.turnOrder.length,
        turnsThisRound: completedRound ? 0 : turnsThisRound,
        roundsCompleted: completedRound
          ? context.roundsCompleted + 1
          : context.roundsCompleted,
        placement: null,
        counters: [],
        pendingCounterIds: [],
        resolution: null,
      };
    }),

    drawCard: assign(({ context }) => {
      const deck = [...context.deck];
      const currentCard = deck.shift() ?? null;
      return { deck, currentCard };
    }),

    setWinner: assign(({ context }) => ({
      winnerId: determineWinner(context),
    })),
  },
  guards: {
    hasOtherPlayers: ({ context }) => context.turnOrder.length > 1,
    counterQueueEmpty: ({ context }) => context.pendingCounterIds.length === 0,
    isGameOver: ({ context }) => isGameOver(context),
    canCounter: ({ context, event }) => {
      if (event.type !== "COUNTER") return false;
      const counterer = context.pendingCounterIds[0];
      if (!counterer) return false;
      const player = context.players.find((p) => p.id === counterer);
      if (!player || player.tokens < 1) return false;
      const active = context.players[context.activeIndex];
      const len = active.timeline.length;
      if (event.slot < 0 || event.slot > len) return false;
      const taken = new Set<number>([
        context.placement?.slot ?? -1,
        ...context.counters.map((c) => c.slot),
      ]);
      return !taken.has(event.slot);
    },
  },
}).createMachine({
  id: "hitster",
  context: ({ input }) => initialContext(input),
  initial: "dealing",
  states: {
    dealing: {
      entry: "dealAndStart",
      always: "playing",
    },
    playing: {
      on: {
        PLACE: [
          {
            guard: "hasOtherPlayers",
            target: "countering",
            actions: "recordPlacement",
          },
          { target: "reveal", actions: "recordPlacement" },
        ],
        // Unspielbare Karte (§8): verwerfen und neue ziehen, gleicher Spieler bleibt am Zug
        SKIP: { target: "drawNext" },
      },
    },
    countering: {
      entry: "setupCounterQueue",
      always: { guard: "counterQueueEmpty", target: "reveal" },
      on: {
        COUNTER: { guard: "canCounter", actions: "recordCounter" },
        PASS: { actions: "skipCounter" },
      },
    },
    reveal: {
      entry: "evaluate",
      on: {
        CONTINUE: { target: "betweenTurns", actions: "applyTokenClaim" },
      },
    },
    betweenTurns: {
      entry: "advanceTurn",
      always: [
        { guard: "isGameOver", target: "gameOver" },
        { target: "drawNext" },
      ],
    },
    drawNext: {
      entry: "drawCard",
      always: "playing",
    },
    gameOver: {
      entry: "setWinner",
      type: "final",
    },
  },
});
