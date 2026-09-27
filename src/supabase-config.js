// Credenciales publicas del proyecto de Supabase (Project Settings > API).
// La "anon public key" esta pensada para ir en el navegador: la seguridad la dan
// las politicas RLS y las funciones de database/schema.sql, no esta clave.
// Si se dejan vacias, el sitio funciona en modo local (localStorage) para desarrollo.
window.RASEC_SUPABASE_CONFIG = {
  url: "",
  anonKey: "",
};
