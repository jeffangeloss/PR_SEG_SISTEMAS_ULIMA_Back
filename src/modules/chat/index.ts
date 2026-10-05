import { ChatController } from "./chat.controller.js";
import { createChatRoutes } from "./chat.routes.js";

const chatController = new ChatController();
export const chatRoutes = createChatRoutes(chatController);

export { ChatController } from "./chat.controller.js";
