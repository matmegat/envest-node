
module.exports = function Admin (db)
{
	var admin = {}

	var exists = db.exists
	var knex   = db.knex

	var table = () => knex('admins')

	admin.is = function (user_id)
	{
		return table()
		.where('user_id', user_id)
		.then(exists)
	}

	admin.intro = function (target_user_id, by_user_id)
	{
		by_user_id || (by_user_id = null)

		// ...
	}

	return admin
}