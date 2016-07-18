
var raw = require('knex').raw

var curry = require('lodash/curry')

var moment = require('moment')

var toId = require('../id').toId

var validate = require('./validate')

var validateId = require('../id').validate
var validateMany = require('../id').validateMany

var Err = require('../Err')

var ClauseNotFound = Err('clause_not_found', 'Clause not found')

var Filter = module.exports = function Filter (clauses)
{
	return function (queryset, options)
	{
		for (var key in options)
		{
			if (key in clauses)
			{
				queryset = clauses[key](queryset, options[key])
			}
			else
			{
				throw ClauseNotFound({ clause: key })
			}
		}

		return queryset
	}
}

Filter.by = {}

Filter.by.operator = curry((operator, column) =>
{
	return function (queryset, value)
	{
		return queryset
		.where(column, operator, value)
	}
})

Filter.by.equal = Filter.by.operator('=')


Filter.by.id = function (column)
{
	var val_id = validateId(wrong_filter('id'))

	return function by_id (queryset, id)
	{
		val_id(id)

		return queryset
		.where(column, id)
	}
}

Filter.by.ids = function (column)
{
	var val_ids = validateMany(wrong_filter('ids'))

	return function by_ids (queryset, ids)
	{
		var ids = ids.split(',')

		val_ids(ids)

		return queryset
		.whereIn(column, ids)
	}
}

Filter.by.dateSubtract = curry((unit, column) =>
{
	var val_id = validateId(wrong_filter(unit))

	return function (queryset, value)
	{
		//toId и validateId ипользуются т.к их логика подходит
		value = toId(value)
		val_id(value)

		var date =  moment()
		.subtract(value, unit)

		return queryset
		.where(column, '>=', date)
	}
})

Filter.by.days   = Filter.by.dateSubtract('days')
Filter.by.weeks  = Filter.by.dateSubtract('weeks')
Filter.by.months = Filter.by.dateSubtract('months')
Filter.by.years  = Filter.by.dateSubtract('years')


var WrongDateFilter = wrong_filter('date')

Filter.by.date = curry((operator, column) =>
{
	return (queryset, date) =>
	{
		date = moment(date)

		if (! date.isValid())
		{
			throw WrongDateFilter()
		}
		else
		{
			return queryset
			.where(column, operator, date)
		}
	}
})

Filter.by.mindate = Filter.by.date('>=')
Filter.by.maxdate = Filter.by.date('<=')


var WrongFilter = Err('wrong_filter', 'Wrong filter')

function wrong_filter (name)
{
	return function ()
	{
		return WrongFilter( { name: name } )
	}
}

Filter.by.name = function by_name (when_column)
{
	return function (queryset, name)
	{
		validate.name(name, 'name')

		var pattern = '%' + name.toLowerCase() + '%'

		return queryset
		.innerJoin('users', 'users.id', when_column)
		.whereRaw("lower(users.first_name || ' ' || users.last_name) LIKE ?",
		pattern)
	}
}

var Symbl = require('./models/symbols/Symbl')

Filter.by.portfolio_symbol = function by_portfolio_symbol (column)
{
	return function (queryset, symbol)
	{
		symbol = Symbl(symbol)

		return queryset
		.innerJoin('portfolio_symbols', 'portfolio_symbols.investor_id', column)
		.where(function ()
		{
			this.where('portfolio_symbols.symbol_ticker', symbol.ticker)
			if (symbol.exchange)
			{
				this.where('portfolio_symbols.symbol_exchange', symbol.exchange)
			}
		})
	}
}

Filter.by.portfolio_symbols = function by_portfolio_symbols (column)
{
	return function (queryset, symbols)
	{
		symbols = symbols.split(',')
		symbols = [].concat(symbols)
		symbols = symbols.map(Symbl)

		var ticker_col = 'portfolio_symbols.symbol_ticker'
		var exchange_col = 'portfolio_symbols.symbol_exchange'

		return queryset
		.innerJoin('portfolio_symbols', 'portfolio_symbols.investor_id', column)
		.whereIn(
			raw(`${ticker_col} || '.' || ${exchange_col}`),
			symbols.map(symbol =>
			{
				return `${symbol.ticker}.${symbol.exchange}`
			})
		)
	}
}

Filter.by.symbol = function by_symbol (column)
{
	return function (queryset, symbol)
	{
		symbol = Symbl(symbol)

		return queryset
		.where(function ()
		{
			this.where(raw(`${column}->>'ticker'`), symbol.ticker)
			if (symbol.exchange)
			{
				this.where(raw(`${column}->>'exchange'`), symbol.exchange)
			}
		})
	}
}

Filter.by.symbols = function by_symbols (column)
{
	return function (queryset, symbols)
	{
		symbols = symbols.split(',')
		symbols = [].concat(symbols)
		symbols = symbols.map(Symbl)

		var where_clause = symbols.map((symbol) =>
		{
			if (symbol.exchange)
			{
				return `{"ticker": "${symbol.ticker}",` +
				` "exchange": "${symbol.exchange}"}`
			}
			else
			{
				return `{"ticker": "${symbol.ticker}"}`
			}
		})

		return queryset
		.where(raw(column), '@>', `[${where_clause.join(',')}]`)
	}
}
