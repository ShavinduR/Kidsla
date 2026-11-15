// Size guide — reviewed against common international kidswear charts and adjusted
// for the slightly slimmer build typical of Sri Lankan / South-Asian children.
//
// BODY measurements (measure the child): height, chest, waist.
// GARMENT measurements (measure our clothes laid flat): T-shirt length, shorts length.
//
// Changes from the original draft:
//  • Added HEIGHT — the most reliable way for parents to pick a size.
//  • Chest nudged down ~0.5" for 3–4Y and 5–6Y (draft ran large for Asian kids).
//  • Waist raised ~1.5" — toddlers' waists are almost the same as their chest
//    (17–18" is a baby/6–12M waist). Elastic waistbands give extra stretch.
//  • Garment lengths kept, but MUST be re-checked against your actual stock.
export const SIZE_GUIDE = [
  { size: '1-2Y', heightCm: '76–92', heightIn: '30–36', chest: '19.5–20.5', waist: '19–19.5', tee: '14', shorts: '9' },
  { size: '3-4Y', heightCm: '92–104', heightIn: '36–41', chest: '21–22', waist: '20–20.5', tee: '16', shorts: '11' },
  { size: '5-6Y', heightCm: '104–116', heightIn: '41–46', chest: '22.5–24', waist: '21–21.5', tee: '18', shorts: '13' },
]

export const CLOTHING_SIZES = SIZE_GUIDE.map((s) => s.size)
