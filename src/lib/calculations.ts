export type MoneyLine = { quantity: number; unitPrice: number; taxRate?: number };
export type JournalLine = { debit: number; credit: number };

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function invoiceTotals(lines: MoneyLine[], discount = 0) {
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
  const tax = roundMoney(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice * (line.taxRate ?? 0), 0));
  return { subtotal, tax, total: roundMoney(Math.max(0, subtotal + tax - discount)) };
}

export function mileageTotal(startingOdometer: number, endingOdometer: number) {
  if (endingOdometer < startingOdometer) throw new Error("Ending odometer cannot be lower than starting odometer");
  return endingOdometer - startingOdometer;
}

export function fuelMetrics(gallons: number, totalCost: number, miles: number) {
  return {
    pricePerGallon: gallons > 0 ? roundMoney(totalCost / gallons) : 0,
    milesPerGallon: gallons > 0 ? roundMoney(miles / gallons) : 0,
    fuelCostPerMile: miles > 0 ? roundMoney(totalCost / miles) : 0,
  };
}

export function estimatedPayroll(grossPay: number, deductions: number, reimbursements: number) {
  return roundMoney(Math.max(0, grossPay - deductions + reimbursements));
}

export function isBalancedJournal(lines: JournalLine[]) {
  const debit = roundMoney(lines.reduce((sum, line) => sum + line.debit, 0));
  const credit = roundMoney(lines.reduce((sum, line) => sum + line.credit, 0));
  return lines.length >= 2 && debit === credit && debit > 0;
}

export function routeProfit(revenue: number, expenses: number, miles: number) {
  return {
    profit: roundMoney(revenue - expenses),
    revenuePerMile: miles > 0 ? roundMoney(revenue / miles) : 0,
    costPerMile: miles > 0 ? roundMoney(expenses / miles) : 0,
  };
}
