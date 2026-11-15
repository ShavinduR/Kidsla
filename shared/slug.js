// URL-friendly link name from a title: "Cloud Ruffle Dress!" → "cloud-ruffle-dress".
// Kept in its own file (no zod) so the shop bundle stays small.
export const slugify = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '')
