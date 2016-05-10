var _ = require('lodash')

module.exports = function Feed (db)
{
	var feed = {}

	feed.db = db

	var knex = db.knex
	var oneMaybe = db.oneMaybe

	feed.feed_table = () => knex('feed_items')
	feed.investors_table = () => knex('investors')
	feed.comments_table = () => knex('comments')

	feed.byId = function (id)
	{
		return feed.feed_table()
			.where('id', id)
			.then(oneMaybe)
	}

	feed.getList = function (options)
	{
		options = options || {}
		options.limit = options.limit || 20

		var feed_queryset = feed.feed_table()
			.orderBy('timestamp', 'desc')
			.limit(options.limit)

		// TODO: clarify reqs for pagination and uncomment
		// if (options.afterId)
		// {
		// 	feed_queryset = feed_queryset
		// 		.where('id', '<', options.afterId)
		// }

		return feed_queryset
		.then((feed_items) =>
		{
			return feed.investors_table()
			.whereIn('id', _.map(feed_items, 'investor_id'))
			.then((investors) =>
			{
				_.each(feed_items, (item) =>
				{
					item.investor = _.find(investors, { id: item.investor_id })
					delete item.investor_id
				})

				return Promise.resolve(feed_items)
			})
		})
		.then((feed_items) =>
		{
			return feed.comments_table()
			.select('feed_id')
			.count('id as count')
			.whereIn('feed_id', _.map(feed_items, 'id'))
			.groupBy('feed_id')
			.then((commentsCount) =>
			{
				_.each(feed_items, (item) =>
				{
					var comments = _.find(commentsCount, { feed_id: item.id })
					if (comments)
					{
						comments = comments.count
					}

					item.comments = comments || 0
				})

				return Promise.resolve(feed_items)
			})
		})
	}

	return feed
}
