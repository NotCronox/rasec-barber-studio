/**
 * Puerta de acceso del admin para la demo local.
 *
 * Esto NO es seguridad real: la contrasena vive en localStorage, en el mismo
 * navegador. Sirve para simular el flujo de "iniciar sesion" mientras el
 * proyecto no tiene backend. Cuando se conecte un backend real, este archivo
 * se reemplaza por autenticacion de verdad (por ejemplo Supabase Auth) y el
 * resto del admin no deberia necesitar cambios, porque solo llama a
 * `window.RasecAuth`.
 */
(function () {
  const PASSWORD_KEY = "rasec_admin_password";
  const SESSION_KEY = "rasec_admin_session";
  const DEFAULT_PASSWORD = "rasec2025";

  function getPassword() {
    return localStorage.getItem(PASSWORD_KEY) || DEFAULT_PASSWORD;
  }

  const Auth = {
    DEFAULT_PASSWORD,

    isAuthenticated() {
      return sessionStorage.getItem(SESSION_KEY) === "true";
    },

    login(password) {
      if (password === getPassword()) {
        sessionStorage.setItem(SESSION_KEY, "true");
        return true;
      }
      return false;
    },

    logout() {
      sessionStorage.removeItem(SESSION_KEY);
    },

    changePassword(currentPassword, newPassword) {
      if (currentPassword !== getPassword()) return false;
      localStorage.setItem(PASSWORD_KEY, newPassword);
      return true;
    },

    hasCustomPassword() {
      return Boolean(localStorage.getItem(PASSWORD_KEY));
    },
  };

  window.RasecAuth = Auth;
})();
