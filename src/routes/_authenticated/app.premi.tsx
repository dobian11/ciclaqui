import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/premi")({
  beforeLoad: async () => {
    throw redirect({
      to: "/app/punti",
      search: { tab: "rewards" },
    });
  },
});
