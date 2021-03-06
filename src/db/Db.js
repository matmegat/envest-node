

var knex = require('knex')

var User = require('./models/User')
var Auth = require('./models/Auth')
var Admin = require('./models/Admin')
var Feed = require('./models/feed/Feed')
var Post = require('./models/feed/Post')
var Comments = require('./models/Comments')
var Investor = require('./models/investor/Investor')
var Notifications = require('./models/notifications/Notifications')
var Static = require('./models/Static')
var Feedback = require('./models/Feedback')
var Pic = require('./models/Pic')
var Subscription = require('./models/subscription/Subscription')
var Symbols = require('./models/symbols/Symbols')
var Watchlist = require('./models/watchlist/Watchlist')


var redis = require('ioredis')


module.exports = function name (app)
{
	var db = {}

	var cfg  = app.cfg
	var conn = cfg.pg
	var rootpath = app.root

	db.helpers = require('./helpers')


	db.knex = knex({
		client: 'pg',
		connection: conn,
		pool:
		{
			min: 2,
			max: 10
		},
	})

	db.redis = redis(app.cfg.redis)
	db.cache = db.helpers.Cache(db.redis, app.cfg.cache)


	db.knex.client.pool.on('error', () =>
	{
		/* we actually can't catch that type of errors */
		/* we can't do anything here */
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
		.then(() =>
		{
			console.info('DB: postgres `%s`', cfg.pg.database)
		})
	})
	.then(() =>
	{
		return db.redis.ping()
		.then(() =>
		{
			console.info('DB: redis `%s`', cfg.redis.db || 0)
		})
	})
	.then(() =>
	{
		console.info('DB: ok')
	})

	db.notifications = Notifications(db)

	db.user = User(db, app)

	db.subscr = Subscription(db, cfg.stripe, app.mmail)
	db.auth  = Auth(db, app.mmail)
	db.admin = Admin(db)

	db.comments = Comments(db)

	db.symbols = Symbols(db, app.cfg, app.log)

	db.investor = Investor(db, app.mmail, app)
	db.watchlist = Watchlist(db)
	db.feed = Feed(db)

	db.post = Post(db)

	db.static = Static(rootpath)
	db.pic = Pic(db)

	db.feedback = Feedback(app)

	return db
}
