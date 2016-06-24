
var Router = require('express').Router
var toss = require('../../toss')
var authRequired = require('../../auth-required')
var pick = require('lodash/pick')
var extend = require('lodash/extend')

module.exports = function (db, http)
{
	var investors = {}

	investors.model = db.investor
	investors.express = Router()
	investors.express.use(authRequired)

	investors.express.get('/', (rq, rs) =>
	{
		var options = pick(rq.query,
		[
			'max_id',
			'since_id',
			'page'
		])
		toss(rs, investors.model.public.list(options))
	})

	investors.express.get('/admin', http.adminRequired, (rq, rs) =>
	{
		var options = pick(rq.query,
		[
			'max_id',
			'since_id',
			'page'
		])
		toss(rs, investors.model.all.list(options))
	})

	investors.express.get('/:id', (rq, rs) =>
	{
		toss(rs, investors.model.public.byId(rq.params.id))
	})

	investors.express.get('/:id/portfolio', (rq, rs) =>
	{
		var options = { investor_id: rq.params.id }

		toss(rs, db.investor.portfolio.list(options))
	})

	investors.express.post('/', http.adminRequired, (rq, rs) =>
	{
		var data = extend({}, rq.body, { admin_id: rq.user.id })
		toss(rs, investors.model.create(data))
	})

	investors.express.post('/:id/field', http.adminRequired, (rq, rs) =>
	{
		var investor_id = rq.params.id

		var field = rq.body.field
		var value = rq.body.value

		toss(rs, investors.model.onboarding.update(investor_id, field, value))
	})

	return investors
}
