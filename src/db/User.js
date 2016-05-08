
module.exports = function User (db)
{
	var user = {}

	user.db = db

	var knex = db.knex
	var oneMaybe = db.oneMaybe
	var one = db.one

	user.users_table    = () => knex('users')
	user.email_confirms = () => knex('email_confirms')

	user.byConfirmedEmail = function (email)
	{
		return user.users_table()
		.where('email', email)
		.then(oneMaybe)
	}

	user.byEmail = function (email)
	{
		return knex.select('*')
		.from(function ()
		{
			this.select(
				'users.id AS id',
				'password',
				'salt',
				'full_name',
				knex.raw('COALESCE(users.email, email_confirms.new_email) AS email')
			)
			.from('users')
			.leftJoin(
				'email_confirms',
				'users.id',
				'email_confirms.user_id'
			)
			.as('ignored_alias')
		})
		.where('email', email)
		.then(oneMaybe)
	}

	user.byId = function (id)
	{
		return user.users_table()
		.where('id', id)
		.then(oneMaybe)
	}

	user.create = function (data)
	{
		return knex.transaction(function (trx)
		{
			user.users_table()
			.transacting(trx)
			.insert({
				full_name: data.full_name,
				email: null,
				password: data.password,
				salt: data.salt
			}
			, 'id')
			.then(one)
			.then(function (id)
			{
				return newEmailCreate({
					user_id: id,
					new_email: data.email,
					code: data.code
				}, trx)
			})
			.then(trx.commit)
			.catch(trx.rollback)
		})
	}

	function newEmailCreate (data, trx)
	{
		return user.email_confirms()
		.transacting(trx)
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
			user.users_table()
			.transacting(trx)
			.where('id', user_id)
			.update({
				email: new_email
			}, 'id')
			.then(one)
			.then(function (id)
			{
				return newEmailDrop(id, trx)
			})
			.then(trx.commit)
			.catch(trx.rollback)
		})
	}

	function newEmailDrop (user_id, trx)
	{
		return user.email_confirms()
		.transacting(trx)
		.where('user_id', user_id)
		.del()
	}

	user.newEmailUpdate = function (data)
	{
		return user.email_confirms()
		.insert(data, 'user_id')
		.then(one)
		.catch( err => {
			if(err.constraint === 'email_confirms_pkey')
			{
				return user.email_confirms()
				.update({
					new_email: data.new_email,
					code: data.code
				})
				.where('user_id', data.user_id)
			}
		})
	}

	return user
}
