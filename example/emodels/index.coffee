Skull = require '../../lib/skull-server'
io = require 'socket.io'
_ = require 'underscore'
express = require 'express'

class MemoryModel extends Skull.Model
	name: '/untitled'
	constructor: ->
		super
		@id = 0
		@items = {}

	create: (data, callback, socket) ->
		data.id = @id++
		@items[data.id] = data
		callback? null, data
		@emit 'create', data, socket

	update: (data, callback, socket) ->
		existing = @items[data.id]
		return callback "item doesn't exist" if not existing
		@items[data.id] = data
		callback? null, data
		@emit 'update', data, socket

	delete: (data, callback, socket) ->
		existing = @items[data.id]
		return callback "item doesn't exist" if not existing
		delete @items[data.id]
		callback? null, data
		@emit 'delete', data, socket

	read: (filter, callback, socket) ->
		items = _.toArray @items
		console.dir items
		callback null, items
		
class Posts extends MemoryModel
	name: '/posts'
	constructor: ->
		super
		@id = 1
		items = [
			id: 1,
			title: 'One post'
			text: 'This is the first item'
		,
			id: 2,
			title: 'Second post'
			text: 'This is the text for second post'
		,
			id: 3,
			title: 'Third post'
			text: 'This is the text for third post'
		]
		
		@create(item, null, null) for item in items
		


	

class Comments extends MemoryModel
	name: '/post-comments'
	constructor: ->
		super
		@id = 1
		items = [
			post_id: 1
			author: 'Hoh'
			text: 'The quick brown'
		,
			post_id: 1
			author: 'Borba'
			text: 'Krala marla bumu kum'
		,
			post_id: 2
			author: 'Juck'
			text: 'Kisi puck, pomada nada'
		,
			post_id: 3
			author: 'JC'
			text: 'Musto rusto klomo dum, akaba mara ?'
		]
		
		@create(item, null, null) for item in items
	
	read: (filter, callback, socket) ->
		console.log 'Comments read. Filter = %j', filter
		items = _.toArray @items
		items = _.filter items, (item) => @matchFilter filter, item
			
		console.dir items
		callback null, items
		

class App
	constructor: (@skullServer) ->
		@io = @skullServer.io
		@app = @skullServer.of '/app'

		@app.addModel new Posts()					#Name is taken from ImageModel::name
		@app.addModel new Comments()
	

app = require('../express-core').init __dirname
server = require('http').createServer(app)
sio = io.listen server

skullApp = new App (new Skull.Server(sio))

port = 4000
server.listen port, ->
	console.info 'Server started on port ' + port


