
var Xign = require('./Xign')
var Symbl = require('./Symbl')

var Err = require('../../../Err')
var UnknownSymbol = Err('unknown_symbol', `Symbol cannot be resolved`)

var invoke = require('lodash/invokeMap')

var Symbols = module.exports = function Symbols (cfg)
{
	var symbols = {}

	var xign = Xign(cfg.xignite)

	symbols.resolve = (symbol) =>
	{
		return Symbl.validate(symbol)
		.then(symbol =>
		{
			return xign.resolve(symbol.toXign())
			.then(resl =>
			{
				var symbol = Symbl(resl.symbol)

				symbol.exchange || (symbol.exchange = resl.exchange)

				var data =
				{
					full:     symbol.toXign(),
					ticker:   symbol.ticker,
					exchange: symbol.exchange,
					company:  resl.company
				}

				return data
			},
			error =>
			{
				throw UnknownSymbol({ symbol: symbol })
			})
		})
	}

	symbols.quotes = (symbols) =>
	{
		symbols = [].concat(symbols)

		symbols = symbols.map(Symbl)

		return xign.quotes(invoke(symbols, 'toXign'))
		.then(resl =>
		{
			return resl.map((r, i) =>
			{
				if (! r)
				{
					return r
				}
				else
				{
					r.symbol = symbols[i]
					r.symbol.full = r.symbol.toXign()
					r.symbol.company = r.company

					return r
				}
			})
		})
		.then(resl =>
		{
			console.log(resl)
			return resl
		})
	}

	// symbols.quotes([ 'WRONG', 'GE.XNYS', 'GLD' ])
	// .then(console.log, console.error)

	// symbols.resolve('GE.XNYS')
	// .then(console.log, console.error)

	return symbols
}


Symbols.schema = {}

/*
 * columns('', table)        = { exchange, ticker }
 * columns('symbol_', table) = { symbol_exchange, symbol_ticker } // REF
 */
Symbols.schema.columns = (prefix, table) =>
{
	prefix || (prefix = '')

	table.string(prefix + 'exchange').notNullable()
	table.string(prefix + 'ticker').notNullable()

	return table
}
