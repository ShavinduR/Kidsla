// Business settings — edit these in one place.

// wa.me ONLY accepts the international format (no "+", no leading 0).
// 0742327807 (local) → 94742327807 (Sri Lanka +94). "wa.me/0742327807" would NOT work.
export const WHATSAPP_NUMBER = '94742327807'
export const WHATSAPP_DISPLAY = '074 232 7807'

// DEFAULTS. The live values are edited in /admin → Settings (stored in MongoDB) and served by /api/settings.
export const DELIVERY_FEES = { colombo: 350, outstation: 400 }

export const DEFAULT_SETTINGS = {
  deliveryFees: { ...DELIVERY_FEES },
  freeDeliveryOver: 0, // LKR; 0 = never free
  payments: { cod: true, bank: true, online: true }, // "online" also needs PayHere keys on the server
  bankDetails: '',
  holdHours: 24, // cash-on-delivery / bank-transfer orders
  onlineHoldMinutes: 60, // card / eZcash orders waiting for payment
}

// All 25 districts. Only Colombo gets the Colombo rate; everything else is outstation.
export const DISTRICTS = [
  'Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya', 'Galle', 'Matara', 'Hambantota',
  'Jaffna', 'Kilinochchi', 'Mannar', 'Vavuniya', 'Mullaitivu', 'Batticaloa', 'Ampara', 'Trincomalee',
  'Kurunegala', 'Puttalam', 'Anuradhapura', 'Polonnaruwa', 'Badulla', 'Monaragala', 'Ratnapura', 'Kegalle',
]

/** Delivery fee for a district and cart subtotal, using the shop settings. 0 until a district is chosen. */
export const deliveryFeeFor = (district, subtotal = 0, settings = DEFAULT_SETTINGS) => {
  if (!district) return 0
  if (settings.freeDeliveryOver > 0 && subtotal >= settings.freeDeliveryOver) return 0
  return district === 'Colombo' ? settings.deliveryFees.colombo : settings.deliveryFees.outstation
}

export const PAYMENT_METHODS = [
  { id: 'cod', label: 'Cash on Delivery', hint: 'Pay when your parcel arrives' },
  { id: 'bank', label: 'Bank Transfer', hint: 'Transfer first, we ship when it arrives' },
  { id: 'online', label: 'Pay Online', hint: 'Card, eZcash, Genie… secured by PayHere' },
]

/** Sri Lankan phone → +94XXXXXXXXX, or null if it doesn't look valid. Accepts 07X…, 011…, +94…, 0094… */
export function normalizePhone(input) {
  const d = String(input ?? '').replace(/[\s()-]/g, '')
  const m = /^(?:\+94|0094|94|0)([1-9]\d{8})$/.exec(d)
  return m ? `+94${m[1]}` : null
}

export const ABOUT_TEXT =
  "KIDSLA is born out of a simple idea: kids' clothing should be as comfortable as it is stylish. 100% Premium Cotton, breathable, and designed for your child's everyday adventures."

export const RETURN_POLICY = [
  'Exchanges accepted within 3 days of delivery.',
  'Items must be unwashed with tags intact.',
  'Customer bears the delivery fee for size / change-of-mind exchanges.',
]
