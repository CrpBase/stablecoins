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
 * Fetches token balances for a given wallet address across multiple
 * chains and calculates the total portfolio value, stablecoin value,
 * and the resulting percentage of stablecoins.
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

  /*
   * To support wallets that hold assets on multiple networks while
   * staying within the limits of a free GoldRush/Covalent API key,
   * we query a curated list of chains one by one. The API's
   * cross‑chain endpoint (`/allchains`) often requires a paid plan,
   * which results in 401 or 404 errors on free tiers. By calling
   * each network individually and aggregating the results locally,
   * we can still provide an approximate cross‑chain portfolio view.
   *
   * The list below contains several popular EVM networks. You can
   * add or remove chain names as needed. See Covalent's docs for
   * supported chain identifiers. The names used here follow
   * GoldRush's convention (e.g. `arbitrum-mainnet`, `base-mainnet`).
   */
  const chainNames = [
    // Ethereum mainnet can be included if you wish to check the
    // primary network as well. Remove it if not needed.
    'eth-mainnet',
    'arbitrum-mainnet',
    'base-mainnet',
    'linea-mainnet',
    'bsc-mainnet',
    'optimism-mainnet',
    'polygon-mainnet'
  ];

  let total = 0;
  let stable = 0;

  // Iterate through each chain sequentially. Performing requests
  // sequentially helps avoid rate‑limit spikes on free tiers. If
  // desired, you can use Promise.all to fetch concurrently, but be
  // aware of API limits (~4 req/s on free plans).
  for (const chain of chainNames) {
    const baseUrl = `https://api.covalenthq.com/v1/${chain}/address/${trimmed}/balances_v2/`;
    const query = new URLSearchParams({
      'quote-currency': 'usd',
      'no-nft-fetch': 'true',
      'no-spam': 'true',
      key: API_KEY
    });
    const url = `${baseUrl}?${query.toString()}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        // Skip chains that return authentication or other errors.
        // Continue to the next chain rather than aborting completely.
        console.warn(`Chain ${chain} responded with status ${response.status}`);
        continue;
      }
      const resData = await response.json();
      if (!resData || !resData.data) {
        console.warn(`Chain ${chain} returned an unexpected response`);
        continue;
      }
      const items = resData.data.items || [];
      for (const item of items) {
        const value = parseFloat(item.quote);
        if (Number.isFinite(value)) {
          total += value;
          if (isStable(item)) {
            stable += value;
          }
        }
      }
    } catch (err) {
      // Network or parsing error – skip this chain and continue.
      console.warn(`Error fetching data for chain ${chain}:`, err);
      continue;
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
