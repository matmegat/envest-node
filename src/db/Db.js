
var knex = require('knex')
var User = require('./User')
var Auth = require('./Auth')

module.exports = function name (app)
{
	var db = {}

	var cfg  = app.cfg
	var conn = cfg.pg

	db.one = one
	db.oneMaybe = oneMaybe

	db.knex = knex({
		client: 'pg',
		connection: conn
	})

	db.knex.client.pool.on('error', () =>
	{
		process.exit(1)
	})

	db.ready = Promise.resolve()
	.then(() =>
	{
		return db.knex.select(knex.raw('NOW()'))
	})
	.then(() =>
	{
		return db.knex('email_confirms')
		.select()
		.limit(0)
	})
	.catch(e =>
	{
		console.error(e)
		process.exit(1)
	})
	.then(() =>
	{
		console.info('DB: ok')
	})

	db.user = User(db)
	db.auth = Auth(db)

	return db
}

function oneMaybe (queryset)
{
	ensureNotMultiple(queryset)

	return queryset[0]
}

function one (queryset)
{
	ensureNotMultiple(queryset)

	if (queryset.length === 0)
	{
		throw new Error('query must return strict 1 entry')
	}

	return queryset[0]
}

function ensureNotMultiple (queryset)
{
	if (! Array.isArray(queryset))
	{
		throw new Error('queryset must be an array')
	}

	if (queryset.length > 1)
	{
		throw new Error('query cannot return more that 1 entry')
	}
}
