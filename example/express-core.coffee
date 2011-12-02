express = require 'express'

exports.init = (viewsDir) ->
	app = express.createServer()
	app.configure ->
		app.use express.bodyParser()
		app.use express.cookieParser()
		app.use express.static __dirname 
		app.use express.session {secret: '$#$wt00ne%%', store: new express.session.MemoryStore}
		app.set 'views', viewsDir
		app.set 'view engine', 'jade'
		app.set 'view options', layout: false

	app.get '/', (req, res) ->
		console.log 'Connect.sid ', req.cookies['connect.sid']
		res.render 'index'
	return app
	
