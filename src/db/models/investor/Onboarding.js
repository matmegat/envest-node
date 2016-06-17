
module.exports = function Onboarding (db, investor)
{
	var onb = {}

	onb.fields = {}

	onb.fields.profession = Profession(investor)
	onb.fields.focus = Focus(investor)
	onb.fields.background = Background(investor)
	onb.fields.hist_return = HistReturn(investor)

	onb.update = function update (investor_id, field, value)
	{
		return new Promise(rs =>
		{
			if (! (field in onb.fields))
			{
				throw WrongField({ field: field })
			}

			field = onb.fields[field]

			rs(field.set(investor_id, value))
		})
	}

	return onb
}

var Err = require('../../../Err')
var WrongField = Err('wrong_field', 'Wrong Onboarding field')


var Field = require('./Field')
var validate = require('../../validate')


var validateProfLength = validate.length(50)

function Profession (investor)
{
	return Field(investor,
	{
		validate: (value) =>
		{
			validate.string(value, 'profession')
			validate.empty(value, 'profession')
			validateProfLength(value, 'profession')
			return value
		},
		set: (value, queryset) =>
		{
			return queryset.update({ profession: value })
		}
	})
}


var validateFocusLength = validate.length(250)

function Focus (investor)
{
	return Field(investor,
	{
		value: (value) =>
		{
			validate.string(value, 'focus')
			validate.empty(value, 'focus')
			validateFocusLength(value, 'focus')
			return value
		},
		set: (value, queryset) =>
		{
			return queryset.update({ focus: value })
		}
	})
}


var validateBackLength = validate.length(3000)

function Background ()
{
	return Field(investor,
	{
		validate: (value) =>
		{
			validate.string(value, 'background')
			validate.empty(value, 'background')
			validateBackLength(value, 'background')
			return value
		},
		set: (value, queryset) =>
		{
			return queryset.update({ background: value })
		}
	})
}

function HistReturn ()
{
	return Field(investor,
	{
		validate: (value) =>
		{

			return value
		},
		set: (value, queryset) =>
		{
			// return queryset.update({ background: value })
		}
	})
}
