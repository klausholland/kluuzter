export type YearSource = "musicbrainz" | "spotify";

export type Card = {
  id: string; // Spotify-Track-ID
  uri: string; // "spotify:track:..." für die Wiedergabe
  title: string;
  artist: string;
  year: number;
  yearSource: YearSource;
  coverUrl: string | null;
};

export type GameMode = "targetCards" | "fixedRounds";

export type PlayerSetup = { id: string; name: string };

export type GameInput = {
  players: PlayerSetup[]; // in Zugreihenfolge
  mode: GameMode;
  targetValue: number; // X Karten bzw. N Runden
  startTokens: number;
  deck: Card[]; // bereits gemischt & angereichert
};

export type Player = {
  id: string;
  name: string;
  tokens: number;
  timeline: Card[]; // aufsteigend nach year sortiert; enthält genau 1 Anker
};

export type CounterPlacement = { playerId: string; slot: number };

export type Resolution = {
  card: Card;
  activePlayerId: string;
  activeSlot: number;
  activeCorrect: boolean;
  counters: Array<{ playerId: string; slot: number; correct: boolean }>;
  winnerId: string | null; // null = verworfen
};

export type GameContext = {
  mode: GameMode;
  targetValue: number;
  players: Player[];
  turnOrder: string[]; // player-ids, gleiche Reihenfolge wie players[]
  activeIndex: number; // Index in turnOrder/players
  deck: Card[]; // restlicher Ziehstapel
  currentCard: Card | null; // aktuelle Mystery-Karte
  placement: CounterPlacement | null; // Platzierung des aktiven Spielers
  counters: CounterPlacement[]; // Konter in Zugreihenfolge
  pendingCounterIds: string[]; // verbleibende Konter-Warteschlange
  resolution: Resolution | null; // letzte Auswertung (für Reveal-UI)
  roundsCompleted: number;
  turnsThisRound: number;
  winnerId: string | null;
};

export type GameEvent =
  | { type: "PLACE"; slot: number }
  | { type: "COUNTER"; slot: number }
  | { type: "PASS" }
  | { type: "CONTINUE"; claimedCorrect: boolean }
  | { type: "SKIP" }; // aktuelle Mystery-Karte verwerfen (z. B. in Region nicht spielbar), neue ziehen, gleicher Spieler
