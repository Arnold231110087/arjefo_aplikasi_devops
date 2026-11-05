const LOAN_DAYS = 7;          
const FINE_PER_DAY = 1000;    
const MAX_ACTIVE_LOANS = 3;   

function toDate(value) {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysLate(dueDate, returnDate = new Date()) {
  const diff = Math.round((toDate(returnDate) - toDate(dueDate)) / 86400000);
  return Math.max(0, diff);
}

function calculateFine(dueDate, returnDate = new Date()) {
  return daysLate(dueDate, returnDate) * FINE_PER_DAY;
}

module.exports = { LOAN_DAYS, FINE_PER_DAY, MAX_ACTIVE_LOANS, daysLate, calculateFine };
