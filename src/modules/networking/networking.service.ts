import type { EventBus } from "../../events/index.js";
import { HttpError } from "../../shared/errors/http-error.js";
import {
  normalizeSocialLink,
  validateNetworkingSelection,
} from "./networking.logic.js";
import type { NetworkingRepository } from "./networking.repository.js";
import type { NetworkingCard, PublicNetworkingCard, UpdateNetworkingRequest } from "./networking.types.js";

export class NetworkingService {
  constructor(
    readonly repository: NetworkingRepository,
    readonly events: EventBus,
  ) {}

  async getMine(userId: number): Promise<NetworkingCard> {
    const card = await this.repository.findByUserId(userId);
    if (!card) throw new HttpError(404, "Usuario no encontrado.", "USER_NOT_FOUND");

    if (card.links.length > 1) {
      throw new HttpError(
        500,
        "El carnet contiene más de una red social.",
        "NETWORKING_DATA_INTEGRITY",
      );
    }

    return card;
  }

  async updateMine(
    userId: number,
    input: UpdateNetworkingRequest,
  ): Promise<NetworkingCard> {
    const validation = validateNetworkingSelection(input);
    switch (validation.status) {
      case "too_many_links":
        throw new HttpError(
          400,
          "El carnet admite una sola red social.",
          "INVALID_NETWORKING_LINK_COUNT",
        );
      case "invalid_link":
        throw new HttpError(
          400,
          "El enlace del carnet no es válido.",
          "INVALID_NETWORKING_LINK",
          { reason: validation.reason },
        );
    }

    const link = input.links[0] ? normalizeSocialLink(input.links[0]) : null;
    const card = await this.repository.replaceByUserId(userId, input.optIn, link);
    if (!card) throw new HttpError(404, "Usuario no encontrado.", "USER_NOT_FOUND");
    return card;
  }

  async getVisibleByUserId(userId: number): Promise<PublicNetworkingCard> {
    const card = await this.repository.findPublicByUserId(userId);
    if (!card) throw new HttpError(404, "Usuario no encontrado.", "USER_NOT_FOUND");

    if (!card.optIn) {
      throw new HttpError(
        403,
        "Este carnet ya no esta disponible.",
        "NETWORKING_CARD_HIDDEN",
      );
    }

    if (card.links.length > 1) {
      throw new HttpError(
        500,
        "El carnet contiene mas de una red social.",
        "NETWORKING_DATA_INTEGRITY",
      );
    }

    return card;
  }
}
