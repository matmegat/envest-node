
var Type = require('./Type')

var pick = require('lodash/pick')

var validate = require('../../validate')
var sanitize = require('../../../sanitize')

var TradeOp = require('../investor/Portfolio/TradeOp/TradeOp')
var DeleteOp = require('../investor/Portfolio/TradeOp/DeleteOp')

module.exports = function Trade (portfolio, symbols)
{
	return Type(
	{
		validate: validate_trade,
		validate_update: validate_trade_adds,
		set: (trx, investor_id, type, timestamp, data) =>
		{
			return symbols.resolve(data.symbol, { other: true })
			.then(symbl =>
			{
				data.symbol = pick(symbl,
				[
					'ticker',
					'exchange'
				])
			})
			.then(() =>
			{
				var tradeop = TradeOp(investor_id, timestamp, data)

				return portfolio.tradeops.apply(trx, tradeop)
			})
			.then(tradeop =>
			{
				data.text = sanitize.sanitize(data.text)

				return [ tradeop.timestamp, data ]
			})
		},
		update: (trx, investor_id, type, timestamp, data) =>
		{
			data.text = sanitize.sanitize(data.text)

			return Promise.resolve(data)
		},
		remove: (trx, post) =>
		{
			var investor_id = post.investor_id
			var timestamp = post.timestamp
			var trade_data = post.data

			var tradeOp = TradeOp(investor_id, timestamp, trade_data)
			var delOp = DeleteOp(tradeOp)

			return portfolio.tradeops.apply(trx, delOp)
		}
	})
}

var validate_risk = validate.collection([ 'low', 'medium', 'high' ])

function validate_trade_adds (data)
{
	var data_update = pick(data,
	[
		'text',
		'risk',
		'motivations'
	])

	var data_restricted = pick(data,
	[
		'dir',
		'symbol',
		'price',
		'amount'
	])

	return new Promise(rs =>
	{
		validate.forbidden(data_restricted)

		if ('text' in data_update)
		{
			validate.nullish(data_update.text, 'text')
			validate.text_field(sanitize.text(data_update.text), 'text')
		}

		if ('risk' in data_update)
		{
			validate.nullish(data_update.risk, 'risk')
			validate.empty(data_update.risk, 'risk')
			validate_risk(data_update.risk)
		}

		if ('motivations' in data_update)
		{
			validate.motivation(data_update.motivations)
		}

		rs(data_update)
	})
}

function validate_trade (data)
{
	var data = pick(data,
	[
		'dir',
		'symbol',
		'price',
		'amount',
		'text',
		'risk',
		'motivations'
	])

	var trade_dirs = ['bought', 'sold']
	var validate_trade_dir = validate.collection(trade_dirs)

	return new Promise(rs =>
	{
		validate_trade_dir(data.dir)

		validate.required(data.text, 'text')
		validate.text_field(sanitize.text(data.text), 'text')

		validate.required(data.symbol, 'symbol')
		validate.empty(data.symbol, 'symbol')

		validate.required(data.price, 'price')
		validate.empty(data.price, 'price')

		validate.required(data.amount, 'amount')
		validate.empty(data.amount, 'amount')

		validate.required(data.risk, 'risk')
		validate.empty(data.risk, 'risk')
		validate_risk(data.risk)

		validate.required(data.motivations, 'motivations')
		validate.empty(data.motivations, 'motivations')
		validate.motivation(data.motivations)

		rs(data)
	})
}
