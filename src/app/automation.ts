// Whether the game is being driven by a program rather than played: a test or a bot, which send no play statistics.

/** What a browser says about itself that gives a program away. */
export interface BrowserSigns {
  /** Set by browsers under automation: Playwright, Puppeteer and Selenium, in a browser or the desktop app. */
  webdriver?: boolean | undefined;
  userAgent: string;
}

/** Crawlers, headless browsers and page checkers name themselves in their user agent. */
const BOT_AGENT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|phantom|puppeteer|playwright|selenium/i;

/** Whether a program, not a player, is driving the game. */
export function automated(signs: BrowserSigns): boolean {
  return signs.webdriver === true || BOT_AGENT.test(signs.userAgent);
}
