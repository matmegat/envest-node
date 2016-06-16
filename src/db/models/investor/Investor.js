var _ = require('lodash')

var generate_code = require('../../../crypto-helpers').generate_code

var knexed = require('../../knexed')

var Err = require('../../../Err')
var AlreadyExists = Err('already_investor', 'This user is investor already')

var expect = require('chai').expect

var Mailer = require('../../../Mailer')

var Meta = require('./Meta')

module.exports = function Investor (db)
{
	var investor = {}

	var knex = db.knex
	var oneMaybe = db.helpers.oneMaybe

	investor.table = knexed(knex, 'investors')

	investor.table_public = (trx) =>
	{
		return investor.table(trx)
		.where('is_public', true)
	}

	var auth = db.auth
	expect(db, 'Investors depends on Auth').property('auth')
	var user = db.user

	investor.all    = Meta(investor.table, {})
	investor.public = Meta(investor.table, { is_public: true })

	investor.create = knexed.transact(knex, (trx, data) =>
	{
		return generate_code()
		.then((password) =>
		{
			var user_data = _.extend({}, data,
			{
				password: password /* new Investor should reset his password */
			})

			return auth.register(user_data)
		})
		.then(() =>
		{
			return user.email_confirms(trx)
			.where('new_email', data.email)
			.then(oneMaybe)
			.then((user_confirm) =>
			{
				return auth.emailConfirm(user_confirm.code)
			})
		})
		.then(() =>
		{
			return user.byEmail(data.email, trx)
		})
		.then((user) =>
		{
			return investor.table(trx)
			.insert(
			{
				user_id: user.id,
				historical_returns: []
			}
			, 'user_id')
			.catch(Err.fromDb('investors_pkey', AlreadyExists))
		})
		.then(oneMaybe)
		.then((investor_id) =>
		{
			/* TODO: sent welcome email
			 * - email verification link: ...
			 * - link to 'set new password'
			 * REQUIRED FIELDS:
			 * - first_name
			 * - last_name
			 * - host
			 * - password_url (password reset url)
			 * - password_code (password reset code)
			 * */
			var mailer = Mailer()
			mailer.send(
			{
				to: data.email,
				first_name: data.first_name,
				last_name: data.last_name,
				host: 'localhost:8080',
				password_url: '/api/auth/change-password',
				password_code: 'PASTE IT HERE'
			}, 'welcome')

			/* TODO: add notification: 'investor created'
			* - to all admins?
			* - to parent admin?
			* - to created investor?
			* */

			return investor.all.byId(investor_id, trx)
		})
	})

	return investor
}
