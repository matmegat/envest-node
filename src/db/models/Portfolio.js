
var expect = require('chai').expect

var _ = require('lodash')

var knexed = require('../knexed')

var Err = require('../../Err')
var WrongBrokerageId = Err('wrong_brokerage_id', 'Wrong Brokerage Id')
var BrokerageNotFound = Err('brokerage_not_found', 'Wrong Brokerage Id')

module.exports = function Portfolio (db)
{
	var portfolio = {}

	var knex    = db.knex
	var helpers = db.helpers

	portfolio.table = knexed(knex, 'portfolio_symbols')
	portfolio.brokerage_table = knexed(knex, 'brokerage')

	expect(db, 'Portfolio depends on Investor').property('investor')
	var investor = db.investor

	portfolio.list = function (options, trx)
	{
		return db.investor.public.ensure(options.investor_id, trx)
		.then(() =>
		{
			return portfolio.table(trx)
			.select(
			[
				'amount',
				'symbols.id',
				'symbols.ticker',
				'symbols.company',
				'brokerage.multiplier'
			])
			.where('portfolio_symbols.investor_id', options.investor_id)
			.innerJoin('symbols', 'portfolio_symbols.symbol_id', 'symbols.id')
			.innerJoin(
				'brokerage',
				'portfolio_symbols.investor_id',
				'brokerage.investor_id'
			)
		})
		.then((portfolio_holdings) =>
		{
			portfolio_holdings = portfolio_holdings.map((portfolio_holding) =>
			{
				var random_price = _.random(50.0, 150.0, true)
				portfolio_holding.allocation =
					portfolio_holding.amount *
					random_price *
					portfolio_holding.multiplier

				portfolio_holding.gain = _.random(-10.0, 10.0, true)
				portfolio_holding.symbol = _.pick(portfolio_holding,
				[
					'id',
					'ticker',
					'company'
				])

				return _.pick(portfolio_holding,
				[
					'symbol',
					'allocation',
					'gain'
				])
			})

			return {
				total: portfolio_holdings.length,
				holdings: _.orderBy(portfolio_holdings, 'allocation', 'desc')
			}
		})
	}

	var brokerage = {}
	portfolio.brokerage = brokerage

	brokerage.is = function (investor_id, trx)
	{
		return validate_id(investor_id)
		.then(() =>
		{
			return portfolio.brokerage_table(trx)
			.where('investor_id', investor_id)
			.then(helpers.oneMaybe)
			.then(Boolean)
		})
	}

	var validate_id = require('../../id')
	.validate.promise(WrongBrokerageId)

	brokerage.ensure = function (investor_id, trx)
	{
		return brokerage.is(investor_id, trx)
		.then(Err.falsy(BrokerageNotFound))
	}

	brokerage.set = knex.transact(knex, (trx, data) =>
	{
		return investor.all.ensure(data.investor_id, trx)
		.then(() =>
		{
			return brokerage.is(data.investor_id, trx)
			.then((is_brokerage) =>
			{
				var queryset = portfolio.brokerage_table(trx)

				if (is_brokerage)
				{
					queryset.where('investor_id', data.investor_id)
					.update({ cash_value: data.brokerage })
				}
				else
				{
					queryset.insert(
					{
						investor_id: data.investor_id,
						cash_value: data.brokerage,
						multiplier: 1.0
					})
				}

				return queryset
			})
		})
	})

	return portfolio
}
