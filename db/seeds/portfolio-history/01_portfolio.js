
var extend = Object.assign

exports.seed = (knex) =>
{
	var day = (day) => day * 1000 * 60 * 60 * 24
	var s = (s) => s * 1000

	var now  = +new Date('Sat Aug 27 2016 20:05:58 +03')
	var prev = now - day(1)

	return get('david.philips@investor.com')
	.then(user =>
	{
		var id = user.id

		/* eslint-disable max-len */
		/* eslint-disable space-infix-ops */
		return insert(id,
		[

{ symbol_exchange: 'XNAS', symbol_ticker: 'TSLA', amount: 1, price: 100,  timestamp: prev      },
{ symbol_exchange: 'XNYS', symbol_ticker: 'GE',   amount: 1, price: 120,  timestamp: prev+s(1) },
{ symbol_exchange: 'XNAS', symbol_ticker: 'TSLA', amount: 3, price: 100,  timestamp: now       },
{ symbol_exchange: 'XNAS', symbol_ticker: 'AAPL', amount: 2, price: 1000, timestamp: now+s(1)  },
{ symbol_exchange: 'XNYS', symbol_ticker: 'GE',   amount: 0, price: 130,  timestamp: now+day(1) },
{ symbol_exchange: 'XNAS', symbol_ticker: 'AAPL', amount: 1, price: 1200, timestamp: now+day(1)+s(1) },

		])
		/* eslint-enable max-len */
		/* eslint-enable space-infix-ops */
	})


	function get (email)
	{
		return knex('users').where('email', email)
		.then(rows => rows[0])
	}

	function insert (id, entries)
	{
		entries = entries.map(entry =>
		{
			return extend({}, entry,
			{
				investor_id:     id,
				timestamp:   new Date(entry.timestamp)
			})
		})

		return knex('portfolio').insert(entries)
	}
}
