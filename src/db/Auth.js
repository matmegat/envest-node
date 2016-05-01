
module.exports = function Auth (db)
{
	var auth = {}

	auth.db = db

	var knex = db.knex

	auth.users = knex('users')
	auth.email_confirms = knex('email_confirms')

	auth.register = function (user)
	{
		return generate_salt()
		.then(salt =>
		{
			return encrypt_pass(user.password, salt)
		})
		.then(obj =>
		{
			return auth.users
			.insert({
				first_name: user.first_name,
				last_name: user.last_name,
				email: user.email,
				password: obj.encrypted_pass,
				salt: obj.salt
			})
		})
	}

	auth.login = function (username, password)
	{
		return auth.byEmail(username)
		.then(user =>
		{
			if (user)
			{
				return compare_passwords(user.password, password, user.salt)
				.then(result =>
				{
					if (result)
					{
						return {
							status: true,
							user: user
						}
					}
					else
					{
						return {
							status: false,
							message: 'Incorrect password.'
						}
					}
				})
			}
			else
			{
				return {
					status: false,
					message: 'Incorrect username.'
				}
			}
		})
	}

	auth.byEmail = function (email)
	{
		return auth.users
		.where('email', email)
		.first()
	}

	auth.byId = function (id)
	{
		return auth.users
		.where('id', id)
		.first()
	}

	return auth
}


// DB salt size = 8 chars (16 bytes), DB password size = 18 chars (36 bytes)
var salt_size     = 16 / 2
var password_size = 36 / 2
var iterations    = 100000

var promisify = require('promisify-node')

var crypto = require('crypto')
var randomBytes = promisify(crypto.randomBytes)
var genHash = promisify(crypto.pbkdf2)

var method = require('lodash/method')
var hex = method('toString', 'hex')

function generate_salt ()
{
	return randomBytes(salt_size)
	.then(hex)
}

function encrypt_pass (password, salt)
{
	return hash(password, '', password_size)
	.then(pass_hash =>
	{
		return hash(pass_hash, salt, password_size)
	})
	.then(str =>
	{
		return {
			encrypted_pass: str,
			salt: salt
		}
	})
}

function hash (password, salt)
{
	return genHash(password, salt, iterations, password_size, 'sha512')
	.then(hex)
}

function compare_passwords (dbPass, formPass, salt)
{
	return encrypt_pass(formPass, salt)
	.then(result =>
	{
		return result.encrypted_pass === dbPass
	})
}