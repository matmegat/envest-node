

var expect = require('chai').expect

var knexed = require('../../../knexed')
var Err = require('../../../../Err')

var Op = require('./TradeOp/Op')
var pickOp = require('./TradeOp/pick-Op')


module.exports = function Tradeops (db, portfolio)
{
	var knex = db.knex

	var table = knexed(knex, 'tradeops')

	var one = db.helpers.one
	var oneMaybe = db.helpers.oneMaybe

	var tradeops = {}

	expect(portfolio, 'Tradeops depends on Holdings').property('holdings')
	var holdings  = portfolio.holdings

	expect(portfolio, 'Tradeops depends on Brokerage').property('brokerage')
	var brokerage = portfolio.brokerage


	// store
	tradeops.store = (tradeop, options) =>
	{
		options = (
		{
			override: false
		},
		options)

		var PK = tradeop.toPK()

		return table().select().where(PK)
		.then(oneMaybe)
		.then(so =>
		{
			if (so)
			{
				if (options.override)
				{
					return table().update().where(PK)
					.set(tradeop.toDb())
				}
				else
				{
					throw DuplicateEntry()
				}
			}
			else
			{
				return table().insert(tradeop.toDb())
				.catch(Err.fromDb('timed_tradeop_unique', DuplicateEntry))
			}
		})
	}

	var DuplicateEntry = Err('tradeop_duplicate',
		'There can be only one trading operation per timestamp for Investor')


	// restore
	tradeops.restore = (investor_id, timestamp) =>
	{
		return byId(investor_id, timestamp)
		.select()
		.then(one)
		.then(load)
	}

	tradeops.sequence = (from_timestamp) =>
	{
		expect(from_timestamp).a('date')

		return table()
		.where('timestamp', '>=', from_timestamp)
		.then(rows => rows.map(load))
	}

	function load (row)
	{
		var C = pickOp(row.type)

		return C(row.investor_id, row.timestamp, row.data)
	}


	// remove
	tradeops.remove = (investor_id, timestamp) =>
	{
		expect(timestamp).a('date')

		return byId(investor_id, timestamp).delete()
	}

	tradeops.undone = (tradeop) =>
	{
		expect(Op.is(tradeop), 'Op type').true
		// TODO check equality

		return tradeops.remove(tradeop.investor_id, tradeop.timestamp)
	}

	function byId (investor_id, timestamp)
	{
		expect(investor_id).a('number')
		expect(timestamp).a('date')

		return table()
		.where('investor_id', investor_id)
		.where('timestamp', timestamp)
	}


	return tradeops
}
