
var expect = require('chai').expect
var moment = require('moment')

var knexed = require('../../knexed')

var Err = require('../../../Err')

module.exports = function NetvestSubsc (db, cfg)
{
	var netvest_subscr = {}

	var knex = db.knex

	expect(db, 'Onboarding depends on Notifications').property('notifications')

	var NoSubscription = Err('no_subscription', 'No Subscription')
	var StripeError = Err('stripe_error', 'Stripe API call failed')

	netvest_subscr.table = knexed(knex, 'subscriptions')
	netvest_subscr.stripe = require('stripe')(cfg.secret_key)

	netvest_subscr.addSubscription = function (user_id, subscription_data)
	{

		return db.user.byId(user_id)
		.then(user =>
		{
			var billing_start = moment(user.created_at).add(1, 'month')

			if (moment().isBefore(billing_start))
			{
				subscription_data.trial_end = Math.floor(billing_start / 1000)
			}
			else
			{
				subscription_data.trial_end = 'now'
			}
			return netvest_subscr.stripe.customers.create(
				subscription_data,
				(err, customer) =>
				{
					if (err)
					{
						throw StripeError()
					}

					var subscription = customer.subscriptions.data[0]
					var option =
					{
						user_id: user_id,
						type: subscription_data.plan,
						stripe_customer_id: customer.id,
						stripe_subscriber_id: subscription.id,
						end_time: moment(subscription.current_period_end * 1000)
						.format('YYYY-MM-DD HH:mm:ss Z')
					}

					return netvest_subscr.table()
					.insert(option, 'id')
					.then(id =>
					{
						return id[0] > 0
					})
				}
			)
		})
	}

	netvest_subscr.getSubscription = (user_id) =>
	{
		return netvest_subscr.table()
		.where('user_id', user_id)
		.then(subscription =>
		{
			if (subscription.length > 0)
			{
				return subscription[0]
			}
			else
			{
				throw NoSubscription()
			}
		})
	}

	netvest_subscr.cancelSubscription = (user_id) =>
	{
		return netvest_subscr.table()
		.where('user_id', user_id)
		.delete()
		.then(result =>
		{
			return { success: result === 1 }
		})
	}

	netvest_subscr.isAble = (user_id) =>
	{
		return netvest_subscr
		.getSubscription(user_id)
		.then(() => true, () => false)
	}

	netvest_subscr.extendSubscription = (subscription_id, next_period_end) =>
	{
		return netvest_subscr.table()
		.where('stripe_subscriber_id', subscription_id)
		.update({
			end_time: moment(next_period_end * 1000)
		})
		.then(result =>
		{
			return { success: result === 1 }
		})
	}

	return netvest_subscr
}
