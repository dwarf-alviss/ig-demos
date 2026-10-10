import { chromium } from "@playwright/test";
// Own a separate headless browser process. Shutdown must not touch the user's Chrome.
export async function reviewBrowser() {
  const server = await chromium.launchServer({
    channel: "chrome",
    headless: true,
    host: "127.0.0.1",
  });
  const browser = await chromium.connect(server.wsEndpoint());
  return {
    browser,
    close: async () => {
      // Playwright's Windows tree-kill calls synchronous taskkill, which hangs
      // on this host. Terminate only our spawned browser root through Node.
      const child = server.process();
      // Ask our browser to close its renderer/GPU children before the fallback.
      await Promise.race([
        browser.newBrowserCDPSession().then(session=>session.send("Browser.close")).catch(()=>{}),
        new Promise(resolve=>setTimeout(resolve,3000)),
      ]);
      if (child.exitCode === null) child.kill("SIGKILL");
      await Promise.race([
        new Promise((resolve) => child.once("exit", resolve)),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    },
  };
}
