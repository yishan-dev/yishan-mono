import { QueryClient } from "@tanstack/react-query";

/** Shared renderer query client for remote REST data. */
export const rendererQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
