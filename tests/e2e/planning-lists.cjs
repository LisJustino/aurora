const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const BASE = process.argv[2] || "http://127.0.0.1:5173";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  try {
    await page.goto(`${BASE}/?preview#planejar`);
    await page.locator(".app").waitFor();
    await page.locator('[data-action="plan-view"][data-v="listas"]').click();
    await page.locator(".simple-list-panel").waitFor();
    assert.equal(
      await page.locator('[data-action="planning-list-select"]').count(),
      2,
    );

    await page.locator("#planning-new-list").fill("Feira");
    await page.locator('.simple-list-create button[type="submit"]').click();
    await page.getByRole("heading", { name: "Feira" }).waitFor();

    await page
      .locator("#planning-list-item-title")
      .fill("- Café\n2. Leite\nfrutas");
    await page.locator('.simple-list-add button[type="submit"]').click();
    await page.getByRole("checkbox", { name: "Concluir: Café" }).waitFor();
    await page.getByRole("checkbox", { name: "Concluir: Leite" }).waitFor();
    await page.getByRole("checkbox", { name: "Concluir: frutas" }).waitFor();

    await page.getByRole("checkbox", { name: "Concluir: Café" }).click();
    await page.locator(".simple-list-completed > summary").click();
    await page.getByRole("checkbox", { name: "Reabrir: Café" }).waitFor();
    await page.getByRole("button", { name: "Reabrir todos" }).click();
    await page.getByRole("checkbox", { name: "Concluir: Café" }).waitFor();
    assert.equal(await page.locator(".simple-list-completed").count(), 0);
    await page.getByRole("button", { name: "Desfazer" }).click();
    await page.locator(".simple-list-completed > summary").click();
    await page.getByRole("checkbox", { name: "Reabrir: Café" }).waitFor();

    await page.getByRole("button", { name: "Renomear lista Feira" }).click();
    await page.locator("#planning-list-rename-name").fill("Mercado");
    await page.locator('#planning-list-rename button[type="submit"]').click();
    await page.getByRole("heading", { name: "Mercado" }).waitFor();
    await page.locator(".simple-list-completed > summary").click();
    await page.getByRole("checkbox", { name: "Reabrir: Café" }).waitFor();
    await page.getByRole("checkbox", { name: "Concluir: Leite" }).waitFor();
    await page.getByRole("checkbox", { name: "Concluir: frutas" }).waitFor();

    await page.setViewportSize({ width: 320, height: 720 });
    const mobileOverflow = await page.evaluate(() => {
      const ancestors = [];
      let element = document.querySelector(".simple-lists");
      while (element) {
        const rect = element.getBoundingClientRect();
        ancestors.push({
          element: `${element.tagName.toLowerCase()}.${String(element.className).replace(/\s+/g, ".")}`,
          x: Math.round(rect.x),
          width: Math.round(rect.width),
          scrollWidth: element.scrollWidth,
        });
        element = element.parentElement;
      }
      const overflowingChildren = Array.from(
        document.querySelectorAll(".simple-lists *"),
      )
        .filter((child) => child.scrollWidth > child.clientWidth + 1)
        .map((child) => ({
          element: `${child.tagName.toLowerCase()}.${String(child.className).replace(/\s+/g, ".")}`,
          width: child.clientWidth,
          scrollWidth: child.scrollWidth,
          minWidth: getComputedStyle(child).minWidth,
        }));
      return {
        pageWidth: document.documentElement.scrollWidth,
        ancestors,
        overflowingChildren,
      };
    });
    assert.equal(
      mobileOverflow.pageWidth <= 320,
      true,
      `Horizontal overflow at 320px: ${JSON.stringify(mobileOverflow)}`,
    );
    await page.setViewportSize({ width: 1440, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );

    await page.getByRole("button", { name: "Excluir lista Mercado" }).click();
    await page
      .getByRole("button", { name: "Excluir lista", exact: true })
      .click();
    await page.locator(".simple-list-completed > summary").click();
    await page.getByRole("checkbox", { name: "Reabrir: Café" }).waitFor();
    await page.getByRole("checkbox", { name: "Concluir: Leite" }).waitFor();
    await page.getByRole("checkbox", { name: "Concluir: frutas" }).waitFor();
    assert.equal(
      await page.locator(".simple-list-panel h3").textContent(),
      "Pessoal",
    );
    assert.deepEqual(errors, []);
    console.log(
      "planning-lists: create, bulk add, complete, rename, safe delete and responsive widths passed.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
