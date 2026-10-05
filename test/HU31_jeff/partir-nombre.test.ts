import { describe, expect, test } from "bun:test";
import { partirNombre } from "../../src/shared/utils/nombre-persona.js";

/**
 * Partir un nombre en apellidos y nombres.
 *
 * Los nombres se guardan como los da miUlima: APELLIDOS y después NOMBRES, con
 * la convención peruana de dos apellidos ("LABORATORIO PRIMERO ALUMNO UNO").
 * De los 367 usuarios, 310 tienen exactamente cuatro palabras.
 *
 * Antes esto vivía COPIADO en siete archivos del backend, todos tomando el
 * ÚLTIMO token como apellido. Con ese criterio la tarjeta de contacto mostraba
 * "UNO, LABORATORIO PRIMERO ALUMNO".
 */
describe("partirNombre", () => {
  test("el caso reportado: dos apellidos y dos nombres", () => {
    expect(partirNombre("LABORATORIO PRIMERO ALUMNO UNO"))
      .toEqual({ lastName: "LABORATORIO PRIMERO", firstName: "ALUMNO UNO" });
  });

  test("dos apellidos y un nombre", () => {
    expect(partirNombre("INTEGRANTE LABORATORIO MARIELA"))
      .toEqual({ lastName: "INTEGRANTE LABORATORIO", firstName: "MARIELA" });
  });

  test("dos apellidos y tres nombres", () => {
    expect(partirNombre("ALUMNA LABORATORIO DANIELA NOEMI SARA"))
      .toEqual({ lastName: "ALUMNA LABORATORIO", firstName: "DANIELA NOEMI SARA" });
  });

  test("con dos palabras se asume un apellido y un nombre", () => {
    expect(partirNombre("PEREZ JUAN")).toEqual({ lastName: "PEREZ", firstName: "JUAN" });
  });

  test("una sola palabra queda como nombre, sin inventar un apellido", () => {
    expect(partirNombre("CHER")).toEqual({ lastName: "", firstName: "CHER" });
  });

  test("vacío o solo espacios no revientan", () => {
    expect(partirNombre("")).toEqual({ lastName: "", firstName: "" });
    expect(partirNombre("   ")).toEqual({ lastName: "", firstName: "" });
    expect(partirNombre(null)).toEqual({ lastName: "", firstName: "" });
  });

  test("los espacios de más no producen palabras fantasma", () => {
    expect(partirNombre("  LABORATORIO   PRIMERO  ALUMNO UNO "))
      .toEqual({ lastName: "LABORATORIO PRIMERO", firstName: "ALUMNO UNO" });
  });

  test("conserva tildes y eñes: es para mostrar, no para comparar", () => {
    expect(partirNombre("PRUEBA NÚÑEZ CRISTÓBAL MATÍAS"))
      .toEqual({ lastName: "PRUEBA NÚÑEZ", firstName: "CRISTÓBAL MATÍAS" });
  });

  test("juntar las dos partes en orden devuelve el nombre original", () => {
    // Invariante que protege el pie del horario: mostrar `lastName firstName`
    // tiene que dar exactamente lo que está guardado.
    for (const n of ["LABORATORIO PRIMERO ALUMNO UNO", "INTEGRANTE LABORATORIO MARIELA", "PEREZ JUAN"]) {
      const { lastName, firstName } = partirNombre(n);
      expect(`${lastName} ${firstName}`.trim()).toBe(n);
    }
  });

  test("con coma, ella manda: no hay nada que adivinar", () => {
    // Es como vienen las filas de docentes sembradas y el horario oficial.
    expect(partirNombre("DOCENTE PEÑA LABORATORIO, TEODORO"))
      .toEqual({ lastName: "DOCENTE PEÑA LABORATORIO", firstName: "TEODORO" });
    expect(partirNombre("DOCENTE DE LABORATORIO, MARCO ANTONIO"))
      .toEqual({ lastName: "DOCENTE DE LABORATORIO", firstName: "MARCO ANTONIO" });
  });

  test("la coma gana incluso cuando el apellido tiene tres palabras", () => {
    // Sin la coma, la convención de dos apellidos cortaría en "DOCENTE PEÑA".
    expect(partirNombre("DOCENTE PEÑA LABORATORIO, TEODORO").lastName).toBe("DOCENTE PEÑA LABORATORIO");
    expect(partirNombre("DOCENTE PEÑA LABORATORIO TEODORO").lastName).toBe("DOCENTE PEÑA");
  });

  test("el criterio viejo (último token = apellido) queda descartado explícitamente", () => {
    const { lastName } = partirNombre("LABORATORIO PRIMERO ALUMNO UNO");
    expect(lastName).not.toBe("UNO");
  });
});
