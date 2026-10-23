export type ProductDetails = {
  productId: string; name: string; sku: string; category: string | null; imageUrl: string | null;
  price: string | null; currency: string | null; availableQty: number | null;
  description: string | null; discount: string | null; attributes: Record<string, string | number | boolean>;
};
export type CheckoutSummaryAction = {
  type: "checkout_summary";
  lines: Array<{ productId: string; name: string; sku: string; quantity: number; unitPrice: string; lineTotal: string; currency: string }>;
  address: { name?: string; address1?: string; address2?: string | null; city?: string; region?: string; postalCode?: string; country?: string };
  subtotal: string; shippingTotal: string | null; taxTotal: string | null; total: string; currency: string; expiresAt: string;
};
export type ProductDetailAction = ProductDetails & { type: "product_detail" };
export type ProductComparisonAction = { type: "product_comparison"; products: ProductDetails[] };
export type FormField = {
  id: string; label: string; type: "text" | "number" | "email" | "tel" | "textarea" | "select" | "radio" | "checkbox" | "date";
  required: boolean; defaultValue?: string | number | boolean; options?: Array<{ label: string; value: string }>;
  min?: number; max?: number; maxLength?: number;
};
export type StructuredFormAction = { type: "structured_form"; action: "show_checkout_form" | "show_address_form" | "show_product_filters"; title: string; fields: FormField[] };
export type AddressFormAction = { type: "address_form" };
export type ChatAction = CheckoutSummaryAction | ProductDetailAction | ProductComparisonAction | StructuredFormAction | AddressFormAction;

export function validateFormValues(fields: FormField[], values: Record<string, string | number | boolean>) {
  const errors: Record<string, string> = {};
  fields.forEach((field) => {
    const value = values[field.id];
    if (field.required && (value === "" || value === undefined || value === false)) errors[field.id] = `${field.label} is required.`;
    if (typeof value === "string" && field.maxLength && value.length > field.maxLength) errors[field.id] = `Use ${field.maxLength} characters or fewer.`;
    if (field.type === "email" && value && typeof value === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors[field.id] = "Enter a valid email address.";
    if (field.type === "number" && value !== "" && value !== undefined) {
      const number = Number(value);
      if (!Number.isFinite(number) || (field.min !== undefined && number < field.min) || (field.max !== undefined && number > field.max)) errors[field.id] = "Enter a value within the allowed range.";
    }
  });
  return errors;
}

function product(value: unknown): ProductDetails {
  if (!value || typeof value !== "object") throw new Error("Product details are invalid.");
  const data = value as Record<string, unknown>;
  const isStringOrNull = (item: unknown): item is string | null => item === null || typeof item === "string";
  if (typeof data.productId !== "string" || typeof data.name !== "string" || typeof data.sku !== "string" || !isStringOrNull(data.category) || !isStringOrNull(data.imageUrl) || !isStringOrNull(data.price) || !isStringOrNull(data.currency) || !(data.description === undefined || isStringOrNull(data.description)) || !(data.discount === undefined || isStringOrNull(data.discount)) || !(data.availableQty === null || (Number.isSafeInteger(data.availableQty) && Number(data.availableQty) >= 0))) throw new Error("Product details are incomplete.");
  const attributes = data.attributes && typeof data.attributes === "object" && !Array.isArray(data.attributes) ? data.attributes as Record<string, string | number | boolean> : {};
  const safeImage = data.imageUrl && /^https?:\/\//i.test(data.imageUrl) ? data.imageUrl : null;
  return { productId: data.productId, name: data.name, sku: data.sku, category: data.category, imageUrl: safeImage, price: data.price, currency: data.currency, availableQty: data.availableQty as number | null, description: data.description === undefined ? null : data.description as string | null, discount: data.discount === undefined ? null : data.discount as string | null, attributes };
}

export function parseChatPayload(value: unknown): { answer: string; actions: ChatAction[] } {
  if (!value || typeof value !== "object") throw new Error("The assistant returned an invalid response. Please retry.");
  const record = value as Record<string, unknown>;
  if (typeof record.answer !== "string" || !record.answer.trim()) throw new Error("The assistant returned an empty response. Please retry.");
  if (record.actions === undefined) return { answer: record.answer, actions: [] };
  if (!Array.isArray(record.actions) || record.actions.length > 4) throw new Error("The assistant returned unsupported interactive content. Please retry.");
  const actions = record.actions.map((action): ChatAction => {
    if (!action || typeof action !== "object") throw new Error("The assistant returned unsupported interactive content. Please retry.");
    const data = action as Record<string, unknown>;
    if (data.type === "address_form") return { type: "address_form" };
    if (data.type === "product_detail") return { ...product(data), type: "product_detail" };
    if (data.type === "product_comparison") {
      if (!Array.isArray(data.products) || data.products.length < 2 || data.products.length > 4) throw new Error("The product comparison is invalid.");
      return { type: "product_comparison", products: data.products.map(product) };
    }
    if (data.type === "structured_form") {
      const allowed = ["show_checkout_form", "show_address_form", "show_product_filters"];
      if (!allowed.includes(String(data.action)) || typeof data.title !== "string" || !data.title.trim() || data.title.length > 100 || !Array.isArray(data.fields) || !data.fields.length || data.fields.length > 12) throw new Error("The form definition is invalid.");
      const ids = new Set<string>();
      const fields = data.fields.map((field): FormField => {
        if (!field || typeof field !== "object") throw new Error("A form field is invalid.");
        const item = field as Record<string, unknown>;
        const types = ["text", "number", "email", "tel", "textarea", "select", "radio", "checkbox", "date"];
        if (typeof item.id !== "string" || !/^[a-z][a-z0-9_]{0,39}$/.test(item.id) || ids.has(item.id) || typeof item.label !== "string" || !item.label.trim() || item.label.length > 100 || !types.includes(String(item.type)) || typeof item.required !== "boolean") throw new Error("A form field definition is invalid.");
        ids.add(item.id);
        const fieldType = item.type as FormField["type"];
        const filterTypes: Record<string, FormField["type"]> = { query: "text", category: "select", min_price: "number", max_price: "number", in_stock: "checkbox", sort: "select" };
        if (data.action === "show_product_filters" && filterTypes[item.id] !== fieldType) throw new Error("Unsupported product filter field.");
        const fieldValue: FormField = { id: item.id, label: item.label, type: fieldType, required: item.required };
        if (item.defaultValue !== undefined && item.defaultValue !== null) {
          if (!["string", "number", "boolean"].includes(typeof item.defaultValue) || String(item.defaultValue).length > 500) throw new Error("A form default is invalid.");
          if ((fieldType === "checkbox" && typeof item.defaultValue !== "boolean") || (fieldType === "number" && (typeof item.defaultValue !== "number" || !Number.isFinite(item.defaultValue))) || (!(["checkbox", "number"] as string[]).includes(fieldType) && typeof item.defaultValue !== "string")) throw new Error("A form default does not match its input type.");
          fieldValue.defaultValue = item.defaultValue as string | number | boolean;
        }
        if (fieldType === "select" || fieldType === "radio") {
          if (!Array.isArray(item.options) || !item.options.length || item.options.length > 30) throw new Error("Form options are invalid.");
          fieldValue.options = item.options.map((option) => {
            if (!option || typeof option !== "object" || typeof (option as Record<string, unknown>).label !== "string" || !(option as Record<string, string>).label.trim() || (option as Record<string, string>).label.length > 100 || typeof (option as Record<string, unknown>).value !== "string" || (option as Record<string, string>).value.length > 100) throw new Error("A form option is invalid.");
            return { label: (option as Record<string, string>).label, value: (option as Record<string, string>).value };
          });
          if (new Set(fieldValue.options.map((option) => option.value)).size !== fieldValue.options.length) throw new Error("Form options must have unique values.");
        }
        for (const key of ["min", "max", "maxLength"] as const) {
          const v = item[key];
          if (v === undefined || v === null) continue;
          if (typeof v !== "number" || !Number.isFinite(v) || (key === "maxLength" && (!Number.isInteger(v) || v < 1 || v > 2000))) throw new Error("Form validation constraints are invalid.");
          fieldValue[key] = v;
        }
        if ((fieldValue.min !== undefined || fieldValue.max !== undefined) && fieldType !== "number") throw new Error("Numeric form constraints require a number field.");
        if (fieldValue.min !== undefined && fieldValue.max !== undefined && fieldValue.min > fieldValue.max) throw new Error("Form minimum cannot exceed its maximum.");
        return fieldValue;
      });
      return { type: "structured_form", action: data.action as StructuredFormAction["action"], title: data.title, fields };
    }
    if (data.type !== "checkout_summary") throw new Error("The assistant returned unsupported interactive content. Please retry.");
    if (!Array.isArray(data.lines) || !data.lines.length || data.lines.length > 100 || typeof data.address !== "object" || !data.address || typeof data.total !== "string" || typeof data.currency !== "string" || typeof data.expiresAt !== "string") throw new Error("The checkout summary is incomplete. Please prepare it again.");
    const lines = data.lines.map((line): CheckoutSummaryAction["lines"][number] => {
      if (!line || typeof line !== "object") throw new Error("The checkout summary is invalid.");
      const item = line as Record<string, unknown>;
      if (["productId", "name", "sku", "unitPrice", "lineTotal", "currency"].some((key) => typeof item[key] !== "string") || !Number.isSafeInteger(item.quantity) || Number(item.quantity) < 1) throw new Error("The checkout summary contains invalid item details.");
      return { productId: item.productId as string, name: item.name as string, sku: item.sku as string, quantity: item.quantity as number, unitPrice: item.unitPrice as string, lineTotal: item.lineTotal as string, currency: item.currency as string };
    });
    return { type: "checkout_summary", lines, address: data.address as CheckoutSummaryAction["address"], subtotal: String(data.subtotal ?? ""), shippingTotal: typeof data.shippingTotal === "string" ? data.shippingTotal : null, taxTotal: typeof data.taxTotal === "string" ? data.taxTotal : null, total: data.total, currency: data.currency, expiresAt: data.expiresAt };
  });
  return { answer: record.answer, actions };
}

export function restoreMessages(value: unknown): Array<{ id: string; role: "assistant" | "user"; text: string; actions?: ChatAction[]; retryQuery?: string }> {
  if (!Array.isArray(value)) return [];
  return value.slice(-60).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const message = item as Record<string, unknown>;
    if (typeof message.id !== "string" || (message.role !== "assistant" && message.role !== "user") || typeof message.text !== "string") return [];
    try {
      const actions = message.actions === undefined ? undefined : parseChatPayload({ answer: "restored", actions: message.actions }).actions;
      return [{ id: message.id, role: message.role, text: message.text, ...(actions ? { actions } : {}), ...(typeof message.retryQuery === "string" ? { retryQuery: message.retryQuery } : {}) }];
    } catch { return [{ id: message.id, role: message.role, text: message.text }]; }
  });
}
