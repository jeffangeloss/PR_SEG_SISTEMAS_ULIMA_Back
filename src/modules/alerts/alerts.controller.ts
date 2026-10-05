import type { Context } from "hono";
import type { AlertsService } from "./alerts.service.js";
import { HttpError } from "../../shared/errors/http-error.js";

export class AlertsController {
  constructor(readonly service: AlertsService) {}

  async getAlerts(c: Context) {
    const studentId = c.get("studentId");
    if (!studentId) {
      throw new HttpError(401, "No autorizado. Estudiante no encontrado.", "STUDENT_NOT_FOUND");
    }

    const alerts = await this.service.getAlertsForStudent(Number(studentId));
    return c.json({ alerts });
  }

  async markRead(c: Context) {
    const studentId = c.get("studentId");
    if (!studentId) {
      throw new HttpError(401, "No autorizado. Estudiante no encontrado.", "STUDENT_NOT_FOUND");
    }

    const alertIdParam = c.req.param("alertId");
    const alertId = parseInt(alertIdParam ?? "", 10);
    if (isNaN(alertId)) {
      throw new HttpError(400, "ID de alerta inválido.", "INVALID_ALERT_ID");
    }

    const updated = await this.service.markAlertAsRead(Number(studentId), alertId);
    if (!updated) {
      throw new HttpError(404, "Alerta no encontrada.", "ALERT_NOT_FOUND");
    }

    return c.json({ message: "Alerta marcada como leída" });
  }
}

