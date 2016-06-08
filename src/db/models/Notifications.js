
var knexed = require('../knexed')
var expect = require('chai').expect

var noop = require('lodash/noop')

var validate   = require('../validate')
var validateId = require('../../id').validate
var Paginator  = require('../Paginator')

var Err = require('../../Err')

module.exports = function Notifications (db)
{
	var notifications = {}

	var knex = db.knex

	var oneMaybe = db.helpers.oneMaybe

	expect(db, 'Notifications depends on User').property('user')
	var user = db.user

	var paginator = Paginator()

	notifications.table = knexed(knex, 'notifications')

	notifications.Emitter = function Emitter (type, options)
	{
		return function NotificationEmit (target_or_event, event)
		{
			var emit =
			{
				type: type
			}

			if (options.target === 'recipient')
			{
				expect(target_or_event).a('number')

				emit.recipient_id = target_or_event
				emit.event        = event

				return notifications.create(emit)
			}
			else if (options.target === 'group')
			{
				expect(target_or_event).a('object')

				emit.group = options.group
				emit.event = target_or_event

				return notifications.createBroadcast(emit)
			}
		}
	}

	notifications.create = function (data)
	{
		return validateNotification(data)
		.then((data) =>
		{
			return notifications.table()
			.insert(data)
			.then(noop)
			.catch(Err.fromDb('notifications_recipient_id_foreign', user.NotFound))
		})
	}

	notifications.createBroadcast = function (data)
	{
		return validateNotification(data)
		.then(() =>
		{
			var query_group = get_query_group(data)

			return notifications.table()
			.insert(knex.raw('(type, event, recipient_id) ?', [query_group]))
			.then(noop)
		})
	}

	var WrongRecipientId = Err('wrong_recipient_id', 'Wrong recipient id')

	// eslint-disable-next-line id-length
	function validateNotification (data)
	{
		return new Promise(rs =>
		{
			validate.required(data.type, 'type')
			validate.empty(data.type, 'type')

			validate.required(data.event, 'event')
			validate.empty(data.type, 'event')
			// validate.json(data.event, 'event')

			if (data.recipient_id)
			{
				validateId(WrongRecipientId, data.recipient_id)
			}

			return rs(data)
		})
	}

	var WrongUserGroup = Err('wrong_user_group', 'Wrong user group')

	// eslint-disable-next-line complexity
	function get_query_group (data)
	{
		if (user.groups.isAdmin(data.group) || user.groups.isInvestor(data.group))
		{
			return knex
			.select(knex.raw('?, ?, user_id', [data.type, data.event]))
			.from(data.group)
		}
		else if (user.groups.isUser(data.group))
		{
			return knex
			.select(knex.raw('?, ?, users.id', [data.type, data.event]))
			.from(data.group)
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
		else
		{
			throw WrongUserGroup()
		}
	}

	notifications.list = function (options)
	{
		var queryset = byUserId(options.user_id)

		return paginator.paginate(queryset, options)
	}

	notifications.byIdType = function (user_id, type)
	{
		return byUserId(user_id)
		.andWhere('type', type)
		.then(oneMaybe)
	}

	function byUserId (user_id)
	{
		return notifications.table()
		.where('recipient_id', user_id)
		.andWhere('is_viewed', false)
	}

	notifications.setViewed = function (recipient_id, viewed_ids)
	{
		return validateViewedIds(viewed_ids)
		.then(() =>
		{
			return notifications.table()
			.update('is_viewed', true)
			.whereIn('id', viewed_ids)
			.andWhere('recipient_id', recipient_id)
			.then(noop)
		})
	}

	var WrongViewedId = Err('wrong_viewed_id', 'Wrong viewed id')

	function validateViewedIds (viewed_ids)
	{
		return new Promise(rs =>
		{
			validate.array(viewed_ids, 'viewed_ids')
			viewed_ids.forEach(validateId(WrongViewedId))

			return rs()
		})
	}

	return notifications
}