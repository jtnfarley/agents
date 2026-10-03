import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto("http://localhost:3000");
await page.waitForSelector("text=THE TABLE", { timeout: 15000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: "C:/Users/jtnfa/AppData/Local/Temp/table2.png" });
await browser.close();
console.log("done");
