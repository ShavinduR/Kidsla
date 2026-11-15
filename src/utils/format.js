const formatter = new Intl.NumberFormat('en-LK', { maximumFractionDigits: 0 })

export const formatLKR = (amount) => `LKR ${formatter.format(amount)}`
