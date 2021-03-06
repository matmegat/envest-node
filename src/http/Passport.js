
var session = require('express-session')
var secret  = 'aoor91xck0'

var RedisStore = require('connect-redis')(session)

var jwt_helpers = require('../jwt-helpers')

var passport = require('passport')
var LocalStrategy = require('passport-local')
var FacebookStrategy = require('passport-facebook-token')
var BearerStrategy = require('passport-http-bearer')

var Err = require('../Err')
var AuthRequired = require('./auth-required').AuthRequired

module.exports = function (express, db)
{
	var user = db.user
	var auth = db.auth

	express.use(session(
	{
		store: new RedisStore({ client: db.redis }),
		name:  'sid',
		secret: secret,
		resave: false,
		saveUninitialized: false
	}))

	express.use(passport.initialize())
	express.use(passport.session())

	passport.serializeUser((user, done) =>
	{
		done(null, user.id)
	})

	passport.deserializeUser((id, done) =>
	{
		user.infoById(id)
		.catch(err =>
		{
			// TODO clear redis?
			if (Err.is(err) && err.code === 'user_not_found')
			{
				return false
			}
			else
			{
				throw err
			}
		})
		.then(user =>
		{
			if (! user)
			{
				user = false
			}
			done(null, user)
		}
		, done)
	})

	useLocal(auth)
	useFacebookToken(auth, user)
	useBearerToken(user)

	return passport
}

function useLocal (auth)
{
	passport.use(new LocalStrategy(
	{
		usernameField: 'email',
		passwordField: 'password',
	}
	, (email, password, done) =>
	{
		auth.login(email, password)
		.then(user_data => done(null, user_data), done)
	}))
}

function useBearerToken (user)
{
	passport.use(new BearerStrategy((token, done) =>
	{
		var decoded = jwt_helpers.verify(token)

		if (decoded && decoded.id)
		{
			user.infoById(decoded.id)
			.then(user => done(null, user))
			.catch(err =>
			{
				if (Err.is(err) && err.code === 'user_not_found')
				{
					return done(AuthRequired())
				}
				else
				{
					return done(err)
				}
			})
		}
		else
		{
			done(null, false)
		}
	}))
}

var clientID = 213309782384928
var clientSecret = '7bb071d47fb514268d2d3e26edca4c57'

function useFacebookToken (auth, user)
{
	passport.use(new FacebookStrategy(
	{
		clientID: clientID,
		clientSecret: clientSecret,
		passReqToCallback: true
	},
	// eslint-disable-next-line max-params
	(req, accessToken, refreshToken, profile, done) =>
	{
		var user_data =
		{
			email: profile.emails[0].value || req.body.email || '',
			first_name: profile.name.givenName,
			last_name: profile.name.familyName,
			facebook_id: profile.id,
			token: accessToken,
			is_manual: ! profile.emails[0].value && req.body.email
		}

		user.byFB(user_data)
		.then(user => done(null, user), done)
	}))
}

