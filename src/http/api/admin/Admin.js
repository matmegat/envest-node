
var Router = require('express').Router
var toss = require('../../toss')

module.exports = function (db, http, admin)
{
	var ctrl = {}

	var express = ctrl.express = Router()

	var feed_model = db.feed
	var investor_model = db.investor

	express.use(http.adminRequired)

	express.post('/intro', (rq, rs) =>
	{
		var by_user_id     = rq.user.id
		var target_user_id = rq.body.target_user_id

		toss(rs, admin.intro(target_user_id, by_user_id))
	})

	express.post('/post-as', (rq, rs) =>
	{
		var feed_item = {}

		var target_user_id = rq.body.target_user_id
		var date = rq.body.date

		return investor_model.ensure(target_user_id)
		.then(() => 
		{
			feed_item.date = date
			feed_item.investor_id = target_user_id
			feed_item.type = rq.body.type
			feed_item.data = rq.body.data

			toss(rs, feed_model.add(feed_item))
		})
		.catch(toss.err(rs))
	})

	return ctrl
}
