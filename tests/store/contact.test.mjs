import { beforeAll, describe, expect, test } from "vitest";
import { get, section, sectionId } from "./store.mjs";

const PATH = "/pages/test-contact";
let page, contact;
beforeAll(async () => {
  page = await get(PATH);
  contact = await section(PATH, await sectionId(PATH, "contact"));
});

const field = (name) =>
  contact.match(
    new RegExp(`<(?:input|textarea)[^>]*name="${name}"[^>]*>`),
  )?.[0];

describe("contact page", () => {
  test("has one h1, which is the heading setting", () => {
    expect(page.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(contact).toMatch(/<h1 class="contact__heading">Get in touch<\/h1>/);
  });

  test("posts a contact form with the email and message required", () => {
    expect(contact).toMatch(/<form[^>]*action="\/contact#ContactForm"/);
    expect(contact).toMatch(/name="form_type" value="contact"/);
    expect(field("contact\\[email\\]")).toMatch(/type="email"/);
    expect(field("contact\\[email\\]")).toMatch(/\srequired/);
    expect(field("contact\\[body\\]")).toMatch(/\srequired/);
    expect(contact).toMatch(/<textarea[^>]*name="contact\[body\]"/);
  });

  test("keeps the name and order number optional and says so in their labels", () => {
    expect(field("contact\\[Name\\]")).not.toMatch(/\srequired/);
    expect(field("contact\\[Order number\\]")).not.toMatch(/\srequired/);
    expect(contact).toMatch(/>\s*Name \(optional\)\s*</);
    expect(contact).toMatch(/>\s*Order number \(optional\)\s*</);
  });

  test("gives every field a label and an autocomplete hint where one applies", () => {
    for (const id of ["name", "email", "order", "body"]) {
      expect(contact).toMatch(new RegExp(`<label[^>]*for="ContactForm-${id}"`));
    }
    expect(field("contact\\[Name\\]")).toMatch(/autocomplete="name"/);
    expect(field("contact\\[email\\]")).toMatch(/autocomplete="email"/);
  });

  test("shows no message before anything is sent", () => {
    expect(contact).not.toMatch(/message--(error|success)/);
  });

  test("renders the side card from its blocks, with real h2 headings and links", () => {
    const aside = contact.match(/<aside[\s\S]*?<\/aside>/)[0];
    expect(contact).toMatch(/<aside[^>]*aria-label="[^"]+"/);
    expect(aside.match(/<h2\s+class="text text--subtitle"/g)).toHaveLength(2);
    expect(aside.match(/<p class="contact-link"/g)).toHaveLength(4);
    expect(aside).toMatch(/href="mailto:hello@example\.com"/);
    expect(aside).toMatch(/href="\/pages\/faq"/);
  });
});
