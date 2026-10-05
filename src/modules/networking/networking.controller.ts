import type { Context } from "hono";
import { validateJson } from "../../shared/middleware/validate-dto.js";
import { updateNetworkingSchema } from "./networking.schemas.js";
import type { NetworkingService } from "./networking.service.js";

export class NetworkingController {
  constructor(readonly service: NetworkingService) {}

  async getMine(c: Context) {
    const userId = Number(c.get("userId"));
    return c.json(await this.service.getMine(userId));
  }

  async updateMine(c: Context) {
    const userId = Number(c.get("userId"));
    const body = await validateJson(c, updateNetworkingSchema);
    return c.json(await this.service.updateMine(userId, body));
  }

  async getVisibleByUserId(c: Context) {
    const userId = Number(c.req.param("userId"));
    return c.json(await this.service.getVisibleByUserId(userId));
  }
}
