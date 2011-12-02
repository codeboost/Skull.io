EventEmitter = require('events').EventEmitter
path = require 'path'
_ = require 'underscore'

exports.idAttribute = 'id'

exports.Model = class Model extends EventEmitter
	autoUnlock: true
	constructor: ->
		@locks = {}
		
		@on 'delete', (data) ->
			console.log 'removing lock due to delete'
			id = data[exports.idAttribute]
			#rough, but right. No need to unlock a model which no longer exists - creates unnecessary traffic
			delete @locks[id]
		
		if @autoUnlock	
			@on 'update', (data, socket) ->
				id = data[exports.idAttribute]
				lock = @locks[id]
				if lock
					cb = -> console.log 'Automatically unlocked ' + id
					@unlock lock, cb #not passing socket here, so that all models (including current) receives the unlock event

	create: (data, callback, socket) -> 
		callback?(null, data)
		@emit 'create', data, socket
		
	update: (data, callback, socket) ->
		callback?(null, data)
		@emit 'update', data, socket
	
	delete: (data, callback, socket) ->
		callback?(null, data)
		@emit 'delete', data, socket
		
	lock: (lockinfo, callback, socket) ->
		return callback? "error" unless lockinfo and lockinfo[exports.idAttribute]
		id = lockinfo[exports.idAttribute]
		return callback? "error", lockinfo unless id
		existing = @locks[id]
		if not existing
			@locks[id] = lockinfo
			callback? null, lockinfo
			return @emit 'lock', lockinfo, socket
		if existing.sid == lockinfo.sid
			return callback? null, lockinfo
		console.log 'Refusing lock'
		callback? "lock failed", lockinfo

	unlock: (lockinfo, callback, socket) ->
		return callback? "error" unless lockinfo and lockinfo[exports.idAttribute]
		id = lockinfo[exports.idAttribute]
		return callback? "error", lockinfo unless id
		existing = @locks[id]
		return callback? "error", lockinfo unless existing
		return callback? "error", lockinfo unless lockinfo.sid == existing.sid
		delete @locks[id]
		callback? null, lockinfo
		@emit 'unlock', lockinfo, socket
		
	unlockAll: (socket) ->
		sid = socket.id
		cb = (err, lockinfo) -> console.log 'Unlocked ', lockinfo[exports.idAttribute]
		sidLocks = _.select @locks, (lock) -> lock.sid == sid
		@unlock lock, cb, socket for lock in sidLocks
		
	broadcast: (data, callback, socket) ->
		@emit 'broadcast', data, socket
		
	#override this method inside your model if you want to 
	#use more advanced filters. By default, the filter tries to match each key of the 'filter'
	#parameter with the same key in the data
	
	matchFilter: (filters, data) ->
		return true unless filters and data
		filters = [filters] unless _.isArray filters
		for filter in filters
			for key, val of filter
				return false unless data[key] == val
		return true
		
		
class ModelHelper
	constructor: (@model, @methods, @socket, @name) ->		
		@handlers = {}
		sid = @socket.id
		@model._sockets ?= {}
		if not @model._sockets[sid] then @model._sockets[sid] = @socket		
		
		for method in @methods
			@handlers[method] = @createHandler method
			@model.on method, @handlers[method]
		
		@socket.on 'disconnect', =>
			@model.removeListener method, @handlers[method] for method in @methods	
			true
	
	createHandler: (method) -> 
		model = @model
		name = @name
		(data, socket) ->
			socketId = socket?.id				
			for sid, skt of model._sockets
				skt.emit method, name, data unless sid is socketId
			true
		

class exports.SidModel extends Model
		methods: ['create', 'update', 'delete', 'lock', 'unlock', 'broadcast']
		constructor: ->
			@usrModels = {}
			for method in @methods
				this[method] = @fwdMethod method
			@read = @fwdMethod 'read'
			@clientCommand = @fwdMethod 'clientCommand'

		addModel: (socket, model) ->
			@usrModels[socket.id] = new ModelHelper model, @methods, socket, @name
			socket.on 'disconnect', =>
				delete model._sockets[socket.id]
			return model
			
		fwdMethod: (method) -> (data, callback, socket) =>
			modelHelper = @usrModels[socket.id]
			modelHelper?.model[method]?(data, callback, socket)
			
				
		
class NSMgr extends EventEmitter
	constructor: (@ns) ->
		@models = {}
		@methods = ['create', 'update', 'delete', 'lock', 'unlock', 'broadcast']
		@ns.on 'connection', (socket) =>

			@addSocketHandler socket, methodName for methodName in @methods
			
			#models don't emit read events, so we only need to handle it from the client
			@addSocketHandler socket, 'read' 
			#client command isn't emitted by the models
			@addSocketHandler socket, 'clientCommand'
			
			socket.filter = {}
			#filter lets the client set a filter for this model:socket pair. 
			#The filter is the parameter to the 'read' method
			#It is useful when the client wants to access only a subset of the data
			#Eg. if clients only needs to work with orders from Spain, it will set up the filter like this:
			#filter = {country: 'Spain'}
			#Now the client will only receive model events where data.country is 'Spain'
			#Models should implement proper filtering based on the parameter of the 'read' event
			socket.on 'disconnect', => 
				mdl.unlockAll(socket) for key, mdl of @models
				console.log 'Socket ' + socket.id + ' disconnected'
				@emit 'disconnect', socket
				
			@emit 'connection', socket
		
	addModel: (name, model) ->
		if not model
			model = name
			name = model?.name
		
		return false unless model and name 
		return false unless _.isString(name) 

		model.name ?= name
		@models[name] = model
		@addModelHandler model, name, methodName for methodName in @methods
		console.log 'Model %s added', name
		model
		
		
	addModelHandler: (model, modelName, eventName) ->		
		return unless model instanceof EventEmitter
		
		model.on eventName, (data, socket) =>
			#Model can include the original socket when emitting the event
			#In that case, the event will NOT be sent to the emitting socket
			#If the socket is not included, the message is broadcasted to everyone
			
			#If any sockets have a filter set up, the data must pass the filter 
			
			console.log 'Emitting event %s on model %s', eventName, modelName			
			srcId = socket?.id
			
			for key, skt of @ns.sockets
				if skt.id != srcId #do not emit to self
					filter = skt.filter?[modelName]
					if model.matchFilter filter, data #true if no filter or data passes filter
						skt.emit eventName, modelName, data 

	addSocketHandler: (socket, eventName) ->		
		socket.on eventName, (modelName, data, callback) =>
			
			if eventName == 'read' then socket.filter[modelName] = data
			
			console.log 'Event %s for model %s from client %s, data: %j', eventName, modelName, socket.id, data
			model = @models[modelName]
			model?[eventName]?(data, callback, socket)
			#a listener might handle more complex model lookups or log all socket events
			@emit eventName, modelName, data, callback, socket
	
class exports.Server
	constructor: (@io) ->
		dir = path.dirname module.filename
		@io.server?.routes?.app.get '/skull.io/skull.io.js', (req, res) ->
			res.sendfile path.join dir, 'skull-client.js'
		
	of: (namespace) ->
		ns = @io.of namespace
		return new NSMgr(ns)
	

		
		
		
		
		
		
		