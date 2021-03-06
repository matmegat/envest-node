/**
 * Purpose:
 * - create brokerage
 * - create holdings
 */

var assign = Object.assign

var extend = require('lodash/extend')
var wrap   = require('lodash/wrap')

var Op       = require('./Op')
var Symbl    = require('../../../symbols/Symbl')
var validate = require('../../../../validate')

var holdings_length = validate.length(Infinity, 1)


module.exports = function InitHoldingsOp (investor_id, timestamp, op_data)
{
	var op = Op(investor_id, timestamp)

	validate.array(op_data, 'holdings')
	holdings_length(op_data, 'holdings')

	op_data.forEach(validate_holding)
	op_data.forEach(transform_holding)

	function validate_holding (h, i)
	{
		validate.required(h.symbol, `holdings[${i}].symbol`)

		validate.required(h.amount, `holdings[${i}].amount`)
		validate.number.nonNegative(h.amount, `holdings[${i}].amount`)

		validate.required(h.price, `holdings[${i}].price`)
		validate.number.nonNegative(h.price, `holdings[${i}].price`)
	}

	function transform_holding (h)
	{
		h.symbol = Symbl(h.symbol)
	}

	op.type = 'init-holdings'

	op.holdings = op_data


	op.toDb = wrap(op.toDb, toDb =>
	{
		return assign(toDb(),
		{
			type: op.type,
			data: JSON.stringify(op.holdings)
		})
	})

	op.apply = (trx, portfolio) =>
	{
		op.holdings.forEach((h) =>
		{   /* adjust appears before apply -> update timestamp in case */
			h.timestamp = op.timestamp
		})
		return portfolio.holdings.set(trx, op.investor_id, op.holdings)
	}

	op.undone = (trx, portfolio) =>
	{
		return Promise.all(op.holdings.map((holding) =>
		{
			return portfolio.holdings
			.remove(trx, extend({}, holding.symbol.toDb(),
			{
				investor_id: op.investor_id,
				timestamp: op.timestamp.toDate()
			}))
		}))
		.then(() => portfolio.brokerage.remove(trx, op.investor_id, op.timestamp))
	}

	op.resolve = (symbols) =>
	{
		return symbols
		.resolveMany(op.holdings.map(h => h.symbol), { other: true })
		.then(resolved_symbols =>
		{
			op.holdings.forEach((holding, i) =>
			{
				holding.symbol = resolved_symbols[i]
			})
		})
	}

	op.inspect = () =>
	{
		var substitution = []

		op.holdings.forEach((holding) =>
		{
			substitution.push(`${holding.symbol.inspect()}` +
			` ${holding.amount} shares per ${holding.price}$`)
		})

		return `INIT HOLDINGS {${op.investor_id}} (${op.timestamp.format()})` +
		` ${substitution.join(', ')}`
	}


	return op
}
