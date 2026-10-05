import { db } from "../../db/index.js";
import { scheduleService } from "../schedule/index.js";
// RS-BE-35: el único archivo del chatbot que importa esta función como valor.
import { readOwnTimeBlocksForAssistant } from "../time-blocks/index.js";
import { ChatbotRepository } from "./chatbot.repository.js";
import { ChatbotService } from "./chatbot.service.js";
import { ChatbotController } from "./chatbot.controller.js";
import { createChatbotRoutes } from "./chatbot.routes.js";

const chatbotRepository = new ChatbotRepository(db);

export const chatbotRoutes = (() => {
  const service = new ChatbotService(chatbotRepository, scheduleService, readOwnTimeBlocksForAssistant);
  const controller = new ChatbotController(service);
  return createChatbotRoutes(controller);
})();
