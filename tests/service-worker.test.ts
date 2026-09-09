// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function worker() {
  const handlers: Record<string, (event: unknown) => void> = {};
  const cache = { addAll: vi.fn().mockResolvedValue(undefined), match: vi.fn().mockResolvedValue(new Response("Offline page")) };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi.fn().mockResolvedValue(["kings-shell-v1", "kings-shell-v2", "unrelated-cache"]),
    delete: vi.fn().mockResolvedValue(true),
  };
  const fetch = vi.fn().mockRejectedValue(new TypeError("Offline"));
  const self = {
    addEventListener: (name: string, handler: (event: unknown) => void) => { handlers[name] = handler; },
    location: { origin: "https://kings.test" },
    skipWaiting: vi.fn().mockResolvedValue(undefined),
    clients: { claim: vi.fn().mockResolvedValue(undefined) },
  };
  runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), { self, caches, fetch, URL, Response });
  const request = (path: string, mode = "navigate", method = "GET") => {
    const respondWith = vi.fn();
    handlers.fetch({ request: { url: new URL(path, self.location.origin).href, method, mode }, respondWith });
    return respondWith;
  };
  return { handlers, cache, caches, fetch, self, request };
}

describe("offline service worker", () => {
  it("installs only public assets and removes the old account-page cache", async () => {
    const w = worker();
    const waitUntil = vi.fn();
    w.handlers.install({ waitUntil });
    await waitUntil.mock.calls[0][0];
    expect(w.cache.addAll).toHaveBeenCalledWith(["/offline.html", "/manifest.webmanifest", "/icon.svg"]);
    expect(w.self.skipWaiting).toHaveBeenCalledOnce();
    w.handlers.activate({ waitUntil });
    await waitUntil.mock.calls[1][0];
    expect(w.caches.delete).toHaveBeenCalledExactlyOnceWith("kings-shell-v1");
    expect(w.self.clients.claim).toHaveBeenCalledOnce();
  });

  it("shows the public offline page for a failed protected navigation", async () => {
    const w = worker();
    const response = await w.request("/driver?load=123").mock.calls[0][0];
    expect(await response.text()).toBe("Offline page");
    expect(w.cache.match).toHaveBeenCalledExactlyOnceWith("/offline.html");
  });

  it("passes through online redirects and server errors without replacing them", async () => {
    const w = worker();
    for (const status of [200, 302, 500]) {
      const online = new Response("Online response", { status });
      w.fetch.mockResolvedValueOnce(online);
      expect(await w.request("/workspace").mock.calls[0][0]).toBe(online);
    }
    expect(w.cache.match).not.toHaveBeenCalled();
  });

  it("returns a valid error response even when offline storage has been evicted", async () => {
    const w = worker();
    w.cache.match.mockResolvedValue(undefined);
    const response = await w.request("/workspace").mock.calls[0][0];
    expect(response.status).toBe(503);
    expect(await response.text()).toContain("Reconnect");
  });

  it("does not intercept mutations, API calls, RSC requests or other origins", () => {
    const w = worker();
    expect(w.request("/driver", "navigate", "POST")).not.toHaveBeenCalled();
    expect(w.request("/api/health", "cors")).not.toHaveBeenCalled();
    expect(w.request("/driver?_rsc=123", "cors")).not.toHaveBeenCalled();
    expect(w.request("https://external.test/", "navigate")).not.toHaveBeenCalled();
    expect(w.fetch).not.toHaveBeenCalled();
  });

  it("can serve cached public assets without serving cached account data", async () => {
    const w = worker();
    await w.request("/icon.svg", "cors").mock.calls[0][0];
    expect(w.cache.match).toHaveBeenCalledExactlyOnceWith("/icon.svg");
    expect(w.request("/driver", "cors")).not.toHaveBeenCalled();
  });
});
