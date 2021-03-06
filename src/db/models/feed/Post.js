
var extend = require('lodash/extend')

var validate = require('../../validate')

var Err = require('../../../Err')

var moment = require('moment')

var Trade = require('./Trade')
var Watchlist = require('./Watchlist')
var Update = require('./Update')

module.exports = function Post (db)
{
	var post = {}

	post.types = {}
	post.types.trade = Trade(db.investor.portfolio, db.symbols, db)
	post.types.watchlist = Watchlist(db)
	post.types.update = Update(db)

	var knex = db.knex

	var Emitter = db.notifications.Emitter

	var PostCreated = Emitter('post_created')
	var PostCreatedA = Emitter('post_created', { group: 'admins' })

	var PostUpdated = Emitter('post_updated')
	var PostUpdatedA = Emitter('post_updated', { group: 'admins' })

	var PostDeleted = Emitter('post_deleted')

	var WrongPostType = Err('wrong_feed_post_type', 'Wrong Feed Post Type')

	// eslint-disable-next-line max-params
	post.upsert = function (trx, investor_id, type, date, data, post_id)
	{
		var post_type

		return db.investor.all.ensure(investor_id, trx)
		.then(() =>
		{
			if (post_id)
			{
				return db.feed.postByInvestor(trx, post_id, investor_id)
				.then(Err.nullish(db.feed.NotFound))
				.then(prev_post =>
				{
					var type = prev_post.type
					var investor_id = prev_post.investor_id

					date = prev_post.timestamp

					post_type = post.types[type]

					return post_type.update(
						trx, investor_id, type, date, data, post_id)
					.then(data =>
					{
						return Promise.resolve()
						.then(() =>
						{
							if (data.pic === null)
							{
								return db.static.remove(prev_post.data.pic)
								.then(() =>
								{
									delete data.pic
									delete prev_post.data.pic
								})
							}
						})
						.then(() =>
						{
							if (data.chart === null)
							{
								delete data.chart
								delete prev_post.data.chart
							}
						})
						.then(() => extend({}, prev_post.data, data))
					})
				})
			}
			else
			{
				if (! (type in post.types))
				{
					throw WrongPostType({ type: type })
				}

				post_type = post.types[type]

				return post_type.set(trx, investor_id, type, date, data)
			}
		})
		.then(data =>
		{
			if (Array.isArray(data))
			{
				/* handle changing timestamp of Trade */
				date = data[0]
				data = data[1]
			}

			return db.feed.upsert(trx, investor_id, type, date, data, post_id)
		})
	}

	var InvestorPostDateErr =
		Err('investor_post_date_exeeded', 'Investor post date exeeded')

	post.update = function (investor_id, post_id, data)
	{
		validate_update_fields(post_id)

		return db.feed.byIdRaw(post_id)
		.then(res_post =>
		{
			return post.create(
				res_post.investor_id, null, res_post.timestamp, data, post_id)
		})
	}

	post.updateAs = function (whom_id, post_id, data)
	{
		validate_update_fields(post_id)

		return db.feed.byIdRaw(post_id)
		.then(res_post =>
		{
			return post.createAs(
				whom_id, res_post.investor_id, res_post.type, null, data, post_id)
		})
	}

	post.create = function (investor_id, type, date, data, post_id)
	{
		return knex.transaction(function (trx)
		{
			date = moment(date || void 0).startOf('second').utc()

			return Promise.resolve()
			.then(() =>
			{
				post.check_operation_date(date)
			})
			.then(() =>
			{
				return post.upsert(trx, investor_id, type, date, data, post_id)
			})
			.then(upserted_post =>
			{
				var investor_id = upserted_post.investor_id

				if (post_id)
				{
					PostUpdatedA(
					{
						by: 'investor',
						investor: [ ':user-id', investor_id ],
						post_id: upserted_post.id
					})
				}
				else
				{
					PostCreatedA(
					{
						by: 'investor',
						investor: [ ':user-id', investor_id ],
						post_id: upserted_post.id
					})
				}
			})
		})
	}

	// eslint-disable-next-line max-params
	post.createAs = function (whom_id, investor_id, type, date, data, post_id)
	{
		return knex.transaction(function (trx)
		{
			date = moment(date || void 0).startOf('second').utc()

			return Promise.resolve()
			.then(() =>
			{
				return validate.date(date)
			})
			.then(() =>
			{
				return post.upsert(trx, investor_id, type, date, data, post_id)
			})
			.then(upserted_post =>
			{
				if (post_id)
				{
					PostUpdated(upserted_post.investor_id,
					{
						by: 'admin',
						admin: [ ':user-id', whom_id ],
						post_id: upserted_post.id
					})
				}
				else
				{
					return PostCreated(upserted_post.investor_id,
					{
						by: 'admin',
						admin: [ ':user-id', whom_id ],
						post_id: upserted_post.id
					})
				}
			})
		})
	}

	post.remove = function (investor_id, post_id, whom_id, soft_mode)
	{
		return knex.transaction(function (trx)
		{
			return db.feed.postByInvestor(trx, post_id, investor_id)
			.then(Err.nullish(db.feed.NotFound))
			.then(res =>
			{
				if (! whom_id)
				{
					post.check_operation_date(res.timestamp)
				}

				return res
			})
			.then(res =>
			{
				if (! soft_mode)
				{
					var post_type = post.types[res.type]

					return post_type.remove(trx, res)
				}
			})
			.then(() =>
			{
				return db.feed.remove(trx, investor_id, post_id)
			})
			.then(() =>
			{
				if (whom_id)
				{
					PostDeleted(investor_id,
					{
						by: 'admin',
						admin: [ ':user-id', whom_id ],
						post_id: post_id
					})
				}
			})
		})
	}

	var PostIdRequired =
		Err('post_id_required', 'Post Id Required')

	function validate_update_fields (post_id)
	{
		if (! post_id)
		{
			throw PostIdRequired()
		}
	}

	post.check_operation_date = (date) =>
	{
		validate.date(date)

		var min_date = moment.utc().startOf('day').subtract(30, 'days')

		if (! moment(date).isSameOrAfter(min_date))
		{
			throw InvestorPostDateErr({ date: date, minDate: min_date })
		}
	}

	return post
}
