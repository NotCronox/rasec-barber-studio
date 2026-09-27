/**
 * Acceso al panel administrativo (`window.RasecAuth`).
 *
 * - Con Supabase: inicio de sesion real (correo + contrasena de Supabase Auth). Ademas
 *   se verifica con is_admin() que la cuenta este registrada en admin_profiles.
 * - Sin Supabase (desarrollo local): una contrasena guardada en este navegador. No es
 *   seguridad real; solo simula el flujo mientras no hay backend.
 */
(function () {
  const supa = window.RasecSupabase;
  const remote = Boolean(supa && supa.configured);

  const PASSWORD_KEY = "rasec_admin_password";
  const SESSION_KEY = "rasec_admin_session";
  const DEFAULT_PASSWORD = "rasec2025";

  // ---------- Modo local ----------

  function localPassword() {
    return localStorage.getItem(PASSWORD_KEY) || DEFAULT_PASSWORD;
  }

  const localAuth = {
    async isAuthenticated() {
      return sessionStorage.getItem(SESSION_KEY) === "true";
    },
    async login(email, password) {
      if (password !== localPassword()) throw new Error("Contrasena incorrecta.");
      sessionStorage.setItem(SESSION_KEY, "true");
    },
    async logout() {
      sessionStorage.removeItem(SESSION_KEY);
    },
    async changePassword(currentPassword, newPassword) {
      if (currentPassword !== localPassword()) throw new Error("La contrasena actual no es correcta.");
      localStorage.setItem(PASSWORD_KEY, newPassword);
    },
    currentEmail() {
      return "";
    },
    hasCustomPassword() {
      return Boolean(localStorage.getItem(PASSWORD_KEY));
    },
    onSessionEnded() {},
  };

  // ---------- Modo Supabase ----------

  let currentEmail = "";

  async function checkAdmin(client) {
    const { data, error } = await client.rpc("is_admin");
    return !error && data === true;
  }

  const remoteAuth = {
    async isAuthenticated() {
      const client = await supa.getClient();
      const { data } = await client.auth.getSession();
      if (!data.session) return false;
      currentEmail = data.session.user.email || "";
      return checkAdmin(client);
    },
    async login(email, password) {
      if (!email || !password) throw new Error("Escribe tu correo y tu contrasena.");
      const client = await supa.getClient();
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        throw new Error(/invalid login/i.test(error.message) ? "Correo o contrasena incorrectos." : error.message);
      }
      if (!(await checkAdmin(client))) {
        await client.auth.signOut();
        throw new Error("Esta cuenta no tiene permisos de administrador.");
      }
      currentEmail = data.user.email || "";
    },
    async logout() {
      const client = await supa.getClient();
      await client.auth.signOut();
      currentEmail = "";
    },
    async changePassword(currentPassword, newPassword) {
      const client = await supa.getClient();
      const { data } = await client.auth.getUser();
      const email = data.user && data.user.email;
      if (!email) throw new Error("Tu sesion expiro. Vuelve a iniciar sesion.");
      const check = await client.auth.signInWithPassword({ email, password: currentPassword });
      if (check.error) throw new Error("La contrasena actual no es correcta.");
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
    },
    currentEmail() {
      return currentEmail;
    },
    hasCustomPassword() {
      return true;
    },
    onSessionEnded(callback) {
      supa.getClient().then((client) => {
        client.auth.onAuthStateChange((event) => {
          if (event === "SIGNED_OUT") callback();
        });
      });
    },
  };

  window.RasecAuth = {
    mode: remote ? "remote" : "local",
    requiresEmail: remote,
    DEFAULT_PASSWORD,
    ...(remote ? remoteAuth : localAuth),
  };
})();
