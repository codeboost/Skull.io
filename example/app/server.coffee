express = require 'express'
SkullApp = require('./example').App

app = express.createServer()


app.configure ->
	app.use express.bodyParser()
	app.use express.cookieParser()
	app.use express.static __dirname
	app.use express.session {secret: '$#$wt00ne%%', store: new express.session.MemoryStore}
	app.set 'views', __dirname
	app.set 'view engine', 'jade'
	app.set 'view options', layout: false

app.get '/', (req, res) ->

	console.log 'Connect.sid ', req.cookies['connect.sid']
	res.render 'index'
	

port = process.env.PORT || 4000

skullApp = new SkullApp
skullApp.createServer app

app.listen port, ->
	console.info 'Server started on port ' + port