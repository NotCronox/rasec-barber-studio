// Credenciales publicas del proyecto de Supabase (Project Settings > API Keys).
// La "publishable key" esta pensada para ir en el navegador: la seguridad la dan
// los permisos, las politicas RLS y las funciones de database/schema.sql, no esta clave.
// Si se dejan vacias, el sitio funciona en modo local (localStorage) para desarrollo.
// El sitio de demostracion (rasecbarberstudio-demo.pages.dev) no usa Supabase: cada visitante
// prueba el sitio y el panel con datos de ejemplo guardados en su propio navegador.
window.RASEC_DEMO_SITE = location.hostname.endsWith("-demo.pages.dev");
window.RASEC_SUPABASE_CONFIG = window.RASEC_DEMO_SITE
  ? { url: "", anonKey: "" }
  : {
      url: "https://xxwyhjesyjsxbgdhzvkk.supabase.co",
      anonKey: "sb_publishable_Y_SawY86ZpH9aJSsxOU8_g_0wU1Mwlk",
    };
