
var knexed = require('../knexed')
var upsert = require('../upsert')

var generate_code = require('../../crypto-helpers').generate_code

var extend = require('lodash/extend')
var pick   = require('lodash/pick')
var ends   = require('lodash/endsWith')

var pick = require('lodash/pick')

var Password = require('./Password')

var Groups = require('./Groups')

var Err = require('../../Err')
var EmailAlreadyExists = Err('email_already_use', 'Email already in use')

var validate_email = require('../validate').email
var PaginatorBooked = require('../paginator/Booked')
var Sorter = require('../Sorter')

module.exports = function User (db, app)
{
	var user = {}

	var mailer = app.mail

	var knex = db.knex

	var one      = db.helpers.one
	var oneMaybe = db.helpers.oneMaybe
	var count = db.helpers.count

	user.users_table    = knexed(knex, 'users')
	user.email_confirms = knexed(knex, 'email_confirms')
	user.auth_facebook  = knexed(knex, 'auth_facebook')

	user.password = Password(db, user, app)

	user.groups = Groups(db, user)

	user.NotFound = Err('user_not_found', 'User not found')

	user.ensure = function (id, trx)
	{
		return user.byId(id, trx)
		.then(Err.nullish(user.NotFound))
	}

	user.byId = function (id, trx)
	{
		return user.validateId(id)
		.then(() =>
		{
			return user.users_table(trx)
			.select(
				'users.id AS id',
				'first_name',
				'last_name',
				'pic',
				knex.raw(
					'COALESCE(users.email, email_confirms.new_email) AS email')
			)
			.leftJoin(
				'email_confirms',
				'users.id',
				'email_confirms.user_id'
			)
			.where('users.id', id)
			.then(oneMaybe)
		})
	}

	var WrongUserId = Err('wrong_user_id', 'Wrong user id')
	user.validateId = require('../../id').validate.promise(WrongUserId)

	user.infoById = function (id)
	{
		return knex.select('*')
		.from(function ()
		{
			this.select(
				'users.id AS id',
				'auth_facebook.facebook_id AS facebook_id',
				'users.first_name AS first_name',
				'users.last_name AS last_name',
				knex.raw(
					'COALESCE(users.email, email_confirms.new_email) AS email'),
				'users.pic AS pic',
				'investors.user_id AS investor_user_id',
				'investors.profile_pic AS profile_pic',
				'investors.profession AS profession',
				'investors.background AS background',
				'investors.historical_returns AS historical_returns',
				'investors.is_public AS is_public',
				'investors.start_date AS start_date',
				'admins.user_id AS admin_user_id',
				'admins.parent AS parent',
				'admins.can_intro AS can_intro',
				knex.raw('(select MAX(start_time) from subscriptions where user_id=users.id) as last_payment_date'),
				knex.raw('(select date_part(\'day\' , SUM(end_time - start_time)) from subscriptions where user_id=users.id) as total_payment_days')
			)
			.from('users')
			.leftJoin(
				'auth_facebook',
				'users.id',
				'auth_facebook.user_id'
			)
			.leftJoin(
				'email_confirms',
				'users.id',
				'email_confirms.user_id'
			)
			.leftJoin(
				'investors',
				'users.id',
				'investors.user_id'
			)
			.leftJoin(
				'admins',
				'users.id',
				'admins.user_id'
			)
			.as('ignored_alias')
			.where('id', id)
		})
		.then(oneMaybe)
		.then(Err.nullish(user.NotFound))
		.then(result =>
		{
			var user_data = {}

			user_data = pick(result,
			[
				'id',
				'first_name',
				'last_name',
				'email',
				'pic',
				'last_payment_date',
				'total_payment_days'
			])

			if (result.investor_user_id)
			{
				user_data.investor = pick(result,
				[
					'profile_pic',
					'profession',
					'background',
					'historical_returns',
					'is_public',
					'start_date',
				])
			}

			if (result.admin_user_id)
			{
				user_data.admin = pick(result,
				[
					'parent',
					'can_intro'
				])
			}

			return user_data
		})
	}

	user.create = knexed.transact(knex, (trx, data) =>
	{
		return ensureEmailNotExists(data.email, trx)
		.then(() =>
		{
			return user.users_table(trx)
			.insert({
				first_name: data.first_name,
				last_name: data.last_name,
				email: null
			}
			, 'id')
			.then(one)
			.then(function (id)
			{
				return user.password.create(id, data.password, trx)
			})
			.then(function (id)
			{
				return user.newEmailUpdate(trx,
				{
					user_id: id,
					new_email: data.email
				})
			})
		})
	})

	/* ensures email not exists in BOTH tables (sparse unique) */
	function ensureEmailNotExists (email, trx)
	{
		return user.byEmail(email, trx)
		.then(Err.existent(EmailAlreadyExists))
	}

	user.byEmail = function (email, trx)
	{
		return new Promise(rs =>
		{
			validate_email(email)
			return rs()
		})
		.then(() =>
		{
			return knex.select('*')
			.transacting(trx)
			.from(function ()
			{
				this.select(
					'users.id AS id',
					'password',
					'salt',
					'first_name',
					'last_name',
					'pic',
					knex.raw(
						'COALESCE(users.email, email_confirms.new_email) AS email')
				)
				.from('users')
				.leftJoin(
					'email_confirms',
					'users.id',
					'email_confirms.user_id'
				)
				.leftJoin(
					'auth_local',
					'users.id',
					'auth_local.user_id'
				)
				.as('ignored_alias')
			})
			.where('email', email.toLowerCase())
			.then(oneMaybe)
		})
	}

	user.list = function (ids)
	{
		return user.users_table()
		.select('id', 'first_name', 'last_name', 'pic')
		.whereIn('id', ids)
	}

	user.byFacebookId = function (facebook_id, trx)
	{
		return user.users_table(trx)
		.leftJoin(
			'auth_facebook',
			'users.id',
			'auth_facebook.user_id'
		)
		.where('facebook_id', facebook_id)
		.then(oneMaybe)
	}

	user.createFacebook = function (data)
	{
		return knex.transaction(function (trx)
		{
			return user.users_table(trx)
			.insert({
				first_name: data.first_name,
				last_name: data.last_name,
				email: null
			}
			, 'id')
			.then(one)
			.then(id =>
			{
				return user.newEmailUpdate(trx,
				{
					user_id: id,
					new_email: data.email
				})
			})
			.then(id =>
			{
				return createFacebookUser({
					user_id: id,
					facebook_id: data.facebook_id
				}, trx)
			})
			.then(() =>
			{
				return user.byFacebookId(data.facebook_id, trx)
			})
			.then(result =>
			{
				return result.id
			})
		})
	}

	user.byFB = function (data)
	{
		return user.byFacebookId(data.facebook_id)
		.then(result =>
		{
			if (! result)
			{
				return user.createFacebook(data)
			}

			return result.id
		})
		.then(id =>
		{
			return user.infoById(id)
		})
	}

	function createFacebookUser (data, trx)
	{
		return user.auth_facebook(trx)
		.insert(data, 'user_id')
		.then(one)
	}

	user.newEmailByCode = function (code)
	{
		return user.email_confirms()
		.where('code', code)
		.then(oneMaybe)
	}

	user.emailConfirm = function (user_id, new_email)
	{
		return knex.transaction(function (trx)
		{
			return user.users_table(trx)
			.where('id', user_id)
			.update({
				email: new_email
			}, 'id')
			.then(one)
			.then(function (id)
			{
				return newEmailRemove(id, trx)
			})
		})
	}

	function newEmailRemove (user_id, trx)
	{
		return user.email_confirms(trx)
		.where('user_id', user_id)
		.del()
	}

	user.newEmailUpdate = function (trx, data)
	{
		data = extend({}, data, { new_email: data.new_email.toLowerCase() })

		return ensureEmailNotExists(data.new_email, trx)
		.then(() =>
		{
			return generate_code()
		})
		.then(code =>
		{
			data.code = code

			var email_confirms_upsert = upsert(
				user.email_confirms(trx),
				'user_id'
			)

			var where = { user_id: data.user_id }

			return email_confirms_upsert(where, data)
			.catch(error =>
			{
				if (error.constraint
				 && ends(error.constraint, 'email_confirms_new_email_unique'))
				{
					throw EmailAlreadyExists()
				}
				else
				{
					throw error
				}
			})
			.then((user_id) =>
			{
				return user.byId(user_id, trx)
			})
			.then((user_item) =>
			{
				mailer.send('default', null,
				{
					to: user_item.email,
					text: 'Email confirm code: '
					+ data.code.toUpperCase()
				})

				return user_item.id
			})
		})
	}

	var paginator = PaginatorBooked()

	var sorter = Sorter(
	{
		order_column: 'last_name',
		allowed_columns: [ 'last_name', 'first_name', 'email' ]
	})

	user.byGroup = function (user_group, options)
	{
		var queryset = users_by_group(user_group)
		.leftJoin(
			'email_confirms',
			'users.id',
			'email_confirms.user_id'
		)

		if (options.filter.query)
		{
			queryset = filter_by_query(queryset, options.filter.query)
		}

		var count_queryset = queryset.clone()

		queryset = sorter.sort(queryset, options.sorter)

		queryset
		.select(
			'users.id',
			'users.first_name',
			'users.last_name',
			knex.raw('COALESCE(users.email, email_confirms.new_email) AS email')
		)

		options.paginator = extend({}, options.paginator,
		{
			real_order_column: 'users.id'
		})

		return paginator.paginate(queryset, options.paginator)
		.then((users) =>
		{
			var response =
			{
				users: users
			}

			return count(count_queryset)
			.then(count =>
			{
				return paginator.total(response, count)
			})
		})
	}

	function users_by_group (group)
	{
		if (user.groups.isUser(group))
		{
			return user.users_table()
			.leftJoin(
				'admins',
				'users.id',
				'admins.user_id'
			 )
			.leftJoin(
				'investors',
				'users.id',
				'investors.user_id'
			)
			.whereNull('admins.user_id')
			.whereNull('investors.user_id')
		}
		else if (user.groups.isAdmin(group))
		{
			return user.users_table()
			.leftJoin(
				'admins',
				'users.id',
				'admins.user_id'
			 )
			.whereNotNull('admins.user_id')
		}
	}

	function filter_by_query (queryset, query)
	{
		var pattern = '%' + query.toLowerCase() + '%'

		return queryset
		.where(function ()
		{
			this.whereRaw(
				"lower(users.first_name || ' ' || users.last_name) LIKE ?",
				pattern)
			this.orWhere('users.email', 'like', pattern)
			this.orWhere('email_confirms.new_email', 'like', pattern)
		})
	}

	var get_pic = require('lodash/fp/get')('pic')

	user.picById = function (id)
	{
		return user.users_table()
		.where('id', id)
		.then(one)
		.then(get_pic)
	}

	user.updatePic = function (data)
	{
		return user.users_table()
		.update(
		{
			pic: data.hash
		})
		.where('id', data.user_id)
	}

	return user
}
