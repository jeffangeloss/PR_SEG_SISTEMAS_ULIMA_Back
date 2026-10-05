import { db } from "../../db/index.js";
import { eventBus } from "../../events/index.js";
import { SectionManagementController } from "./section-management.controller.js";
import { SectionManagementRepository } from "./section-management.repository.js";
import { createSectionManagementRoutes } from "./section-management.routes.js";
import { SectionManagementService } from "./section-management.service.js";

const sectionManagementRepository = new SectionManagementRepository(db);
const sectionManagementService = new SectionManagementService(sectionManagementRepository, eventBus);
const sectionManagementController = new SectionManagementController(sectionManagementService);

export const sectionManagementRoutes = createSectionManagementRoutes(sectionManagementController);

export { SectionManagementController } from "./section-management.controller.js";
export { SectionManagementRepository } from "./section-management.repository.js";
export { SectionManagementService } from "./section-management.service.js";
export * from "./section-management.schemas.js";
export * from "./section-management.types.js";
