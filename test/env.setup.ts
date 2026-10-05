// Bootstrap de entorno para la suite de tests (preload en bunfig.toml).
// Setea secretos dummy para los módulos que cargan `config` al importarse
// (p.ej. el controller de chat vía firebase.service → app-config → env).
// No afecta a la app real: `||=` solo rellena lo ausente, respetando `.env`.
process.env.JWT_SECRET ||= "test-jwt-secret";
process.env.DATABASE_URL ||= "postgres://user:pass@localhost:5432/test";
// El módulo chatbot (Cohere) valida COHERE_API_KEY al cargar `config`. Los tests
// mockean el cliente Cohere, así que basta un dummy para pasar la validación.
process.env.COHERE_API_KEY ||= "test-cohere-key";
