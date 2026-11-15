// Browser side of PayHere: the server signs everything; we just post the form.
export const LAST_ORDER_KEY = 'kidsla-last-order'

/** Send the browser to PayHere's checkout page with the signed fields from our server. */
export function submitToPayHere({ action, fields }) {
  const form = Object.assign(document.createElement('form'), { method: 'POST', action })
  for (const [name, value] of Object.entries(fields)) form.append(Object.assign(document.createElement('input'), { type: 'hidden', name, value }))
  document.body.append(form)
  form.submit()
}
