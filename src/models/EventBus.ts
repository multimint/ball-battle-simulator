// Typed synchronous event emitter — bridges physics events to the game layer
// without circular imports between hooks.

type Listener<T> = (payload: T) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class TypedEventBus<EventMap extends Record<string, any>> {
  private listeners: {
    [K in keyof EventMap]?: Listener<EventMap[K]>[];
  } = {};

  on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): () => void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event]!.push(listener);
    // Return unsubscribe function
    return () => this.off(event, listener);
  }

  off<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): void {
    const arr = this.listeners[event];
    if (!arr) return;
    this.listeners[event] = arr.filter((l) => l !== listener) as Listener<EventMap[K]>[];
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    const arr = this.listeners[event];
    if (!arr) return;
    for (const l of arr) l(payload);
  }

  clear(): void {
    this.listeners = {};
  }
}

// ─── Game Event Map ───────────────────────────────────────────────────────────

export interface GameEvents {
  /** Ball A or B took damage */
  damage: { team: 'A' | 'B'; amount: number; x: number; y: number };
  /** A collision happened between the two balls */
  ballCollision: { normalImpulse: number; x: number; y: number };
  /** A weapon effect should be spawned */
  weaponEffect: { effect: import('./GameState').WeaponEffect };
  /** A particle burst should be spawned */
  particleBurst: { x: number; y: number; color: string; count: number };
  /** Heavy hit — trigger screen shake + slow motion */
  heavyHit: { magnitude: number };
  /** Match should end */
  matchEnd: { winner: 'A' | 'B' | 'draw' };
}

export const gameBus = new TypedEventBus<GameEvents>();
