/**
 * Cliente de Supabase compartido. La libreria solo se descarga si hay
 * credenciales en src/supabase-config.js.
 */
(function () {
  const config = window.RASEC_SUPABASE_CONFIG || {};
  const configured = Boolean(config.url && config.anonKey);
  const LIBRARY_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

  let clientPromise = null;

  function loadLibrary() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = LIBRARY_URL;
      script.onload = () => resolve(window.supabase);
      script.onerror = () => reject(new Error("No se pudo conectar con el servidor. Revisa tu conexion e intenta de nuevo."));
      document.head.appendChild(script);
    });
  }

  // Se guarda la promesa (no el cliente) para que llamadas simultaneas al cargar
  // la pagina no creen varios clientes.
  function getClient() {
    if (!configured) return Promise.resolve(null);
    if (!clientPromise) {
      clientPromise = loadLibrary().then((library) => library.createClient(config.url, config.anonKey));
    }
    return clientPromise;
  }

  window.RasecSupabase = { configured, getClient };
})();
