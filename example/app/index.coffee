Skull = require '../../lib/skull-server'
io = require 'socket.io'
_ = require 'underscore'
express = require 'express'

class TodoModel extends Skull.Model
	name: '/todos'
	constructor: ->
		@todos = {}
		@id = 1445
		super
	
	create: (data, callback, socket) ->
		data.id = @id++
		@todos[data.id] = data
		callback null, data
		@emit 'create', data, socket
	
	update: (data, callback, socket) ->
		existing = @todos[data.id]
		return callback "item doesn't exist" if not existing
		@todos[data.id] = data
		callback null, data
		@emit 'update', data, socket
	
	delete: (data, callback, socket) ->
		existing = @todos[data.id]
		return callback "item doesn't exist" if not existing
		delete @todos[data.id]
		callback null, data
		@emit 'delete', data, socket
	
	read: (filter, callback, socket) ->
		items = _.toArray @todos
		console.dir items
		callback null, items
		
class ImageModel extends Skull.Model
	name: '/image'
	constructor: ->
		@url = 'http://placehold.it/580x580'
		super
		
	read: (filter, callback, socket) ->
		callback null, {url: @url, id: '_oneimage_'}
			
	update: (data, callback, socket) ->
		@url = data.url
		callback null, data
		@emit 'update', data, socket
		
class UserSetting extends Skull.Model
	constructor: (@id) ->
		@settings = 
			id: 'user_' + @id
			name: 'No name'
			country: 'No country'
			
	read: (filter, callback, socket) ->
		console.log 'Reading settings for user ', @id
		callback null, @settings
	
	update: (data, callback, socket) ->
		console.log 'Updating settings for user ', @id
		@settings = data #don't do this. Always pluck the settings you need and validate them 
		callback null, @settings
		@emit 'update', @settings, socket
				
class UserSettings
	settings: {} 
	get: (sid) ->
		existing = @settings[sid]
		if not existing then existing = @settings[sid] = new UserSetting sid
		existing

class App 
	
	constructor: (app) ->
		
		userSettings = new UserSettings
		
		@io = io.listen app
		
		@io.set 'authorization', (data, cb) ->
			res = {}
			express.cookieParser() data, res, -> 
				console.log 'Parsed cookies: %j', data.cookies
				sid = data.cookies['connect.sid']
				return cb("Not authorized", false) if not sid
				console.log 'Authorized user ', sid
				data.sid = sid
				cb(null, true)
		
		
		@skullServer = new Skull.Server @io
	
		@global = @skullServer.of '/global'
		@app = @skullServer.of '/app'

		@app.addModel new ImageModel()					#Name is taken from ImageModel::name
		@app.addModel '/todos', new TodoModel() #Here we specify an explicit name
		
	
		#Holds settings for all users
		@settingsHandler = @global.addModel '/mySettings', new Skull.SidModel
		
		
		@global.on 'connection', (socket) =>
			console.log 'Connection to global from ', socket.id
			usModel = userSettings.get socket.handshake.sid
			if usModel
				@settingsHandler.addModel socket, usModel 
			else
				console.log 'User settings not found. This should not happen.'
		
		@io.sockets.on 'connection', (socket) =>
			console.log 'Socket connection from ', socket.id
			
#Start the server
expressApp = require('../express-core').init __dirname
skullApp = new App expressApp
port = 4000
expressApp.listen port, ->
	console.info 'Server started on port ' + port
			
			
			
			
			
			
			
			
			
			
			
			
			
			
			
			
			
			
			
			
			
			
			