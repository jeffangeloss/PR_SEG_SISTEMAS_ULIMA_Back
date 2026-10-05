import type { DomainEventMap, DomainEventName } from "./event-types.js";

type AnyDomainEventHandler = (payload: unknown) => void | Promise<void>;

export class EventBus {
  private readonly handlers = new Map<DomainEventName, Set<AnyDomainEventHandler>>();

  subscribe<K extends DomainEventName>(
    eventName: K,
    handler: (payload: DomainEventMap[K]) => void | Promise<void>,
  ) {
    const handlers = this.handlers.get(eventName) ?? new Set<AnyDomainEventHandler>();
    const typedHandler = handler as AnyDomainEventHandler;

    handlers.add(typedHandler);
    this.handlers.set(eventName, handlers);

    return () => {
      handlers.delete(typedHandler);
    };
  }

  async publish<K extends DomainEventName>(eventName: K, payload: DomainEventMap[K]) {
    const handlers = this.handlers.get(eventName);
    if (!handlers) return;

    await Promise.all([...handlers].map((handler) => handler(payload)));
  }
}

export const eventBus = new EventBus();
