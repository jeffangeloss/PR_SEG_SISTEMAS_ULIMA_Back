import { db } from "../../db/index.js";
import { eventBus } from "../../events/index.js";
import { NetworkingController } from "./networking.controller.js";
import { NetworkingRepository } from "./networking.repository.js";
import { createNetworkingRoutes } from "./networking.routes.js";
import { NetworkingService } from "./networking.service.js";

const networkingRepository = new NetworkingRepository(db);
const networkingService = new NetworkingService(networkingRepository, eventBus);
const networkingController = new NetworkingController(networkingService);

export const networkingRoutes = createNetworkingRoutes(networkingController);

export { NetworkingController } from "./networking.controller.js";
export {
  isHttpUrl,
  normalizeSocialLink,
  urlBelongsToPlatform,
  validateNetworkingSelection,
  validateSocialLink,
} from "./networking.logic.js";
export { NetworkingRepository } from "./networking.repository.js";
export { createNetworkingRoutes } from "./networking.routes.js";
export { socialLinkSchema, updateNetworkingSchema } from "./networking.schemas.js";
export { NetworkingService } from "./networking.service.js";
export type {
  NetworkingCard,
  SocialLink,
  SocialLinkInput,
  SocialPlatform,
  UpdateNetworkingRequest,
} from "./networking.types.js";
