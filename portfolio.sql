CREATE TABLE portfolio
(
  investor_id INTEGER NOT NULL
    REFERENCES investors(user_id),

  symbol_exchange VARCHAR NOT NULL,
  symbol_ticker   VARCHAR NOT NULL,

  timestamp TIMESTAMP NOT NULL,

  amount INTEGER NOT NULL,
  price  DECIMAL(12, 2) NOT NULL,

  CONSTRAINT timed_portfolio_symbol_unique
    UNIQUE (investor_id, symbol_exchange, symbol_ticker, timestamp)
);

--CREATE INDEX portfolio_symbol_unique ON portfolio
--  (investor_id, symbol_exchange, symbol_ticker);

--
SELECT
  symbol_exchange,
  symbol_ticker,
  amount,
  price

FROM
  portfolio AS P

WHERE investor_id = 120
  AND amount > 0
  AND timestamp =
  (
    SELECT MAX(timestamp) FROM portfolio
    WHERE investor_id     = P.investor_id
      AND symbol_exchange = P.symbol_exchange
      AND symbol_ticker   = P.symbol_ticker
    -- AND timestamp <= NOW()
  );
--

CREATE TABLE brokerage
(
  investor_id INTEGER NOT NULL
    REFERENCES investors(user_id),

  timestamp TIMESTAMP NOT NULL,

  cash DECIMAL(12, 2) NOT NULL,
  multiplier REAL NOT NULL,

  CONSTRAINT timed_brokerage_point_unique
    UNIQUE (investor_id, timestamp)
);
