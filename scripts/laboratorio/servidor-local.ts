// Punto de entrada del backend de laboratorio (ver LABORATORIO.md). Sirve la misma app de
// src/server.ts, pero escucha solo en 127.0.0.1, así que ningún otro equipo de la red puede
// llegar a la API del laboratorio. Con `bun run src/server.ts`, bun sirve el export por
// defecto en todas las interfaces; este archivo no exporta nada y abre el servidor él mismo.
import app from "../../src/server.ts";

const HOST_LOCAL = "127.0.0.1";
const puerto = Number(process.env.PORT ?? 3000);

const servidor = Bun.serve({ hostname: HOST_LOCAL, port: puerto, fetch: app.fetch });

console.log(`Backend de laboratorio en http://${servidor.hostname}:${servidor.port} (solo esta Mac)`);
