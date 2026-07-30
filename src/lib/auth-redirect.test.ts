import { describe, it, expect } from "vitest";
import { resolveRedirect } from "./auth-redirect";

describe("resolveRedirect", () => {
  it("porta il ciclista/cittadino nell'app", () => {
    expect(resolveRedirect({ isAdmin: false, isManager: false, hasCompany: false })).toBe("/app");
  });

  it("porta il manager con ente alla dashboard ente", () => {
    expect(resolveRedirect({ isAdmin: false, isManager: true, hasCompany: true })).toBe("/azienda");
  });

  it("porta il manager senza ente all'onboarding", () => {
    expect(resolveRedirect({ isAdmin: false, isManager: true, hasCompany: false })).toBe(
      "/azienda/onboarding",
    );
  });

  it("porta l'admin nell'area admin", () => {
    expect(resolveRedirect({ isAdmin: true, isManager: false, hasCompany: false })).toBe("/admin");
  });

  it("l'admin ha priorità sul ruolo manager", () => {
    expect(resolveRedirect({ isAdmin: true, isManager: true, hasCompany: true })).toBe("/admin");
  });
});
