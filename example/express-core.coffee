express = require 'express'
app = express()
path = require 'path'

exports.init = (viewsDir) ->
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

	app.get '/skull.io/skull.io.js', (req, res) ->
		res.sendfile path.join(__dirname, '../lib/skull-client.js')
	
	return app
	
