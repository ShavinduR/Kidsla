// Business settings — edit these in one place.

// wa.me ONLY accepts the international format (no "+", no leading 0).
// 0742327807 (local) → 94742327807 (Sri Lanka +94). "wa.me/0742327807" would NOT work.
export const WHATSAPP_NUMBER = '94742327807'
export const WHATSAPP_DISPLAY = '074 232 7807'

export const DELIVERY_FEES = { colombo: 350, outstation: 400 }

// All 25 districts. Only Colombo gets the Colombo rate; everything else is outstation.
export const DISTRICTS = [
  'Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Matale', 'Nuwara Eliya', 'Galle', 'Matara', 'Hambantota',
  'Jaffna', 'Kilinochchi', 'Mannar', 'Vavuniya', 'Mullaitivu', 'Batticaloa', 'Ampara', 'Trincomalee',
  'Kurunegala', 'Puttalam', 'Anuradhapura', 'Polonnaruwa', 'Badulla', 'Monaragala', 'Ratnapura', 'Kegalle',
]

export const deliveryFeeFor = (district) =>
  !district ? 0 : district === 'Colombo' ? DELIVERY_FEES.colombo : DELIVERY_FEES.outstation

export const PAYMENT_METHODS = [
  { id: 'cod', label: 'Cash on Delivery', hint: 'Pay when your parcel arrives' },
  { id: 'bank', label: 'Bank Transfer', hint: 'We’ll send bank details on WhatsApp' },
]

export const ABOUT_TEXT =
  "KIDSLA is born out of a simple idea: kids' clothing should be as comfortable as it is stylish. 100% Premium Cotton, breathable, and designed for your child's everyday adventures."

export const RETURN_POLICY = [
  'Exchanges accepted within 3 days of delivery.',
  'Items must be unwashed with tags intact.',
  'Customer bears the delivery fee for size / change-of-mind exchanges.',
]
