import assert from "node:assert/strict";
import test from "node:test";
import { addressSchema } from "../src/schemas/addressSchema.ts";

const valid = {
  name: "Customer Name", phone: "+1 555 234 1234", address1: "12 Market Street",
  address2: null, city: "Austin", region: "Texas", postalCode: "78701", country: "us",
};

test("validates and normalizes a submitted address", () => {
  assert.equal(addressSchema.parse(valid).country, "US");
});

test("rejects invalid phone, postal code, and country fields", () => {
  assert.equal(addressSchema.safeParse({ ...valid, phone: "bad" }).success, false);
  assert.equal(addressSchema.safeParse({ ...valid, postalCode: "!" }).success, false);
  assert.equal(addressSchema.safeParse({ ...valid, country: "USA" }).success, false);
});
