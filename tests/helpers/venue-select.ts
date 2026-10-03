import type { Page } from "@playwright/test";

const names = {
  pacifica: "Pacifica",
  bulk: "BULK",
  phoenix: "Phoenix",
  velocity: "Velocity",
};
export async function chooseVenue(
  page: Page,
  label: "Execution venue" | "Chart source",
  venue: keyof typeof names,
) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page
    .getByRole("listbox", { name: label, exact: true })
    .getByRole("option", { name: names[venue], exact: true })
    .click();
}
