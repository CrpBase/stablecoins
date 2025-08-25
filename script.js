/*
 * Stablecoin Portfolio Checker
 *
 * This script fetches token balances for a given wallet from
 * Covalent's GoldRush API and calculates the percentage of the
 * portfolio that is held in stablecoins. It then displays the
 * results on the page.
 */

// List of common stablecoin tickers (in uppercase). You can add more tickers if needed.
const STABLECOIN_TICKERS = [
  'USDC', 'USDT', 'DAI', 'FRAX', 'TUSD', 'BUSD', 'USDP', 'USDD', 'GUSD',
  'LUSD', 'RSV', 'SAI', 'MIM', 'USDN', 'FEI', 'CUSD', 'SUSD', 'BUSD',
  'XSGD', 'EURS', 'HUSD', 'USDK', 'USDS', 'USDE', 'USDL', 'PAI', 'YUSD'
];

// Your Covalent API key. In a production setting you should not expose
// your API key in client‑side code. Instead, proxy the request through
// a backend or use environment variables on your hosting platform.
const API_KEY = 'cqt_rQ4Rj36cD34jH39R849DTwBRJFkH';

/**
 * Determines whether a given token object represents a stablecoin.
 *
 * The check looks at both the ticker symbol and the contract name.
 * Some tokens include the word "USD" or "STABLE" in their name; this
 * heuristic helps catch additional stablecoins that might not be in
 * the ticker list.
 *
 * @param {Object} token - A token item returned from the API
 * @returns {boolean} True if the token is considered a stablecoin
 */
function isStable(token) {
  const symbol = (token.contract_ticker_symbol || '').toUpperCase();
  const name = (token.contract_name || '').toUpperCase();
  if (STABLECOIN_TICKERS.includes(symbol)) {
    return true;
  }
  // Heuristic: look for USD or STABLE in the name/symbol
  return /\bUSD\b|\bSTABLE\b/.test(symbol) || /\bUSD\b|\bSTABLE\b/.test(name);
}

/**
 * Fetches token balances for a given wallet address and calculates
 * the total portfolio value, stablecoin value, and the resulting
 * percentage of stablecoins.
 *
 * @param {string} address - The wallet address to query
 * @returns {Promise<{total:number, stable:number, percentage:number}>}
 */
async function getPortfolioBreakdown(address) {
  // Trim and validate the address
  const trimmed = address.trim();
  if (!trimmed) {
    throw new Error('Адреса не може бути порожньою');
  }
  // Build the URL for the Cross Chain Balances endpoint
  const baseUrl = `https://api.covalenthq.com/v1/allchains/address/${trimmed}/balances/`;
  const query = new URLSearchParams({
    'quote-currency': 'usd',
    'no-nft-fetch': 'true',
    'no-spam': 'true'
  });
  const url = `${baseUrl}?${query.toString()}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`
    }
  });
  if (!response.ok) {
    throw new Error(`Помилка запиту: ${response.status}`);
  }
  const resData = await response.json();
  // Handle API error messages
  if (!resData || !resData.data) {
    throw new Error('Неправильна відповідь сервера');
  }
  const items = resData.data.items || [];
  let total = 0;
  let stable = 0;
  for (const item of items) {
    // Each item has a "quote" field containing the current value in USD
    const value = parseFloat(item.quote);
    if (Number.isFinite(value)) {
      total += value;
      if (isStable(item)) {
        stable += value;
      }
    }
  }
  const percentage = total > 0 ? (stable / total) * 100 : 0;
  return { total, stable, percentage };
}

/**
 * Formats a number into a human readable string with USD currency
 * formatting and up to two decimal places.
 *
 * @param {number} value - The number to format
 * @returns {string}
 */
function formatUsd(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

/**
 * Handles click events on the "Перевірити" button. Reads the address
 * from the input, calls the API, and updates the DOM with the results.
 */
async function handleCheck() {
  const addressInput = document.getElementById('address');
  const resultDiv = document.getElementById('result');
  // Clear previous result
  resultDiv.classList.add('hidden');
  resultDiv.innerHTML = '';
  const address = addressInput.value;
  try {
    const { total, stable, percentage } = await getPortfolioBreakdown(address);
    // Build the result markup
    const html = [];
    html.push(`<h2>Результат</h2>`);
    html.push(`<p>Загальна вартість портфелю: <strong>${formatUsd(total)}</strong></p>`);
    html.push(`<p>Вартість стейблів: <strong>${formatUsd(stable)}</strong></p>`);
    html.push(`<p>Частка стейблів у портфелі: <strong>${percentage.toFixed(2)}%</strong></p>`);
    resultDiv.innerHTML = html.join('');
    resultDiv.classList.remove('hidden');
  } catch (err) {
    resultDiv.innerHTML = `<p class="error">${err.message}</p>`;
    resultDiv.classList.remove('hidden');
  }
}

// Attach event listener when the DOM has loaded
document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('checkButton');
  button.addEventListener('click', () => {
    handleCheck();
  });
});